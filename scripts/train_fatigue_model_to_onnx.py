from __future__ import annotations

import argparse
from pathlib import Path
from typing import List, Tuple

import numpy as np


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train fatigue classifier and export ONNX")
    parser.add_argument(
        "--data-root",
        default=r"C:\Users\DIANNA\Documents\facial datasets\Data",
        help="Dataset root containing Fatigue and NonFatigue folders",
    )
    parser.add_argument(
        "--output-dir",
        default="models/fatigue_level_detection",
        help="Directory to write trained artifacts",
    )
    parser.add_argument("--epochs", type=int, default=12, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--img-size", type=int, default=224, help="Input image size")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--dry-run", action="store_true", help="Only inspect data and split stats")
    return parser.parse_args()


def collect_paths(data_root: Path) -> Tuple[List[str], List[int]]:
    class_map = [("Fatigue", 0), ("NonFatigue", 1)]
    paths: List[str] = []
    labels: List[int] = []

    for class_name, class_idx in class_map:
        class_dir = data_root / class_name
        if not class_dir.exists():
            raise FileNotFoundError(f"Missing class folder: {class_dir}")

        for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp"):
            for img in class_dir.rglob(ext):
                paths.append(str(img))
                labels.append(class_idx)

    if not paths:
        raise RuntimeError(f"No images found under {data_root}")

    return paths, labels


def split_dataset(paths: np.ndarray, labels: np.ndarray, seed: int):
    from sklearn.model_selection import train_test_split

    x_train, x_temp, y_train, y_temp = train_test_split(
        paths,
        labels,
        test_size=0.30,
        random_state=seed,
        stratify=labels,
    )
    x_val, x_test, y_val, y_test = train_test_split(
        x_temp,
        y_temp,
        test_size=0.50,
        random_state=seed,
        stratify=y_temp,
    )
    return (x_train, y_train), (x_val, y_val), (x_test, y_test)


def build_tf_dataset(paths, labels, img_size: int, batch_size: int, training: bool):
    import tensorflow as tf

    autotune = tf.data.AUTOTUNE

    ds_paths = tf.data.Dataset.from_tensor_slices(paths)
    ds_labels = tf.data.Dataset.from_tensor_slices(labels.astype(np.int32))

    def _load(path, label):
        image = tf.io.read_file(path)
        image = tf.image.decode_image(image, channels=3, expand_animations=False)
        image = tf.image.resize(image, [img_size, img_size])
        image = tf.cast(image, tf.float32)
        return image, label

    ds = tf.data.Dataset.zip((ds_paths, ds_labels)).map(_load, num_parallel_calls=autotune)
    if training:
        ds = ds.shuffle(min(len(paths), 4096), seed=42)
    return ds.batch(batch_size).prefetch(autotune)


def build_model(img_size: int):
    import tensorflow as tf

    inputs = tf.keras.Input(shape=(img_size, img_size, 3), name="input")
    x = tf.keras.layers.Rescaling(1.0 / 127.5, offset=-1)(inputs)
    base = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_tensor=x,
        pooling="avg",
    )
    base.trainable = False

    x = tf.keras.layers.Dropout(0.25)(base.output)
    outputs = tf.keras.layers.Dense(2, activation="softmax", name="fatigue_logits")(x)
    model = tf.keras.Model(inputs=inputs, outputs=outputs, name="fatigue_binary")

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model, base


def export_onnx(model, output_path: Path):
    import tensorflow as tf
    import tf2onnx

    spec = (tf.TensorSpec((None, model.input_shape[1], model.input_shape[2], 3), tf.float32, name="input"),)
    tf2onnx.convert.from_keras(model, input_signature=spec, output_path=str(output_path), opset=13)


def main() -> int:
    args = parse_args()
    np.random.seed(args.seed)

    data_root = Path(args.data_root)
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    paths, labels = collect_paths(data_root)
    paths_np = np.array(paths)
    labels_np = np.array(labels, dtype=np.int32)

    (x_train, y_train), (x_val, y_val), (x_test, y_test) = split_dataset(paths_np, labels_np, args.seed)

    print(f"Dataset root: {data_root}")
    print(f"Total images: {len(paths_np)}")
    print(f"Class distribution: fatigue={int((labels_np == 0).sum())}, nonfatigue={int((labels_np == 1).sum())}")
    print(f"Split sizes: train={len(x_train)}, val={len(x_val)}, test={len(x_test)}")

    if args.dry_run:
        print("Dry run complete.")
        return 0

    import tensorflow as tf

    train_ds = build_tf_dataset(x_train, y_train, args.img_size, args.batch_size, training=True)
    val_ds = build_tf_dataset(x_val, y_val, args.img_size, args.batch_size, training=False)
    test_ds = build_tf_dataset(x_test, y_test, args.img_size, args.batch_size, training=False)

    model, base = build_model(args.img_size)

    callbacks = [
        tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", mode="max", patience=4, restore_best_weights=True),
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(out_dir / "fatigue_best.weights.h5"),
            monitor="val_accuracy",
            mode="max",
            save_best_only=True,
            save_weights_only=True,
        ),
    ]

    model.fit(train_ds, validation_data=val_ds, epochs=args.epochs, callbacks=callbacks, verbose=1)

    # Short fine-tuning phase.
    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=2e-5),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(train_ds, validation_data=val_ds, epochs=4, callbacks=callbacks, verbose=1)

    test_loss, test_acc = model.evaluate(test_ds, verbose=0)
    print(f"Test accuracy: {test_acc:.4f}, loss: {test_loss:.4f}")

    keras_model_path = out_dir / "fatigue_binary.keras"
    model.save(str(keras_model_path))
    print(f"Saved Keras model: {keras_model_path}")

    onnx_main = out_dir / "fatigue_binary.onnx"
    export_onnx(model, onnx_main)
    print(f"Exported ONNX: {onnx_main}")

    # Backward-compatible duplicates for existing runtime lookup.
    for alias in ("model_random.onnx", "model_split.onnx"):
        alias_path = out_dir / alias
        alias_path.write_bytes(onnx_main.read_bytes())
        print(f"Wrote alias ONNX: {alias_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
