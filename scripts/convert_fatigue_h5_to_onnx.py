from __future__ import annotations

from pathlib import Path


def build_mobilenet_weights_model(tf_module):
    keras = tf_module.keras
    model = keras.Sequential(name="fatigue_mobilenet")
    model.add(keras.layers.Rescaling(1.0 / 127.5, offset=-1, input_shape=(224, 224, 3)))
    model.add(
        keras.applications.MobileNetV2(
            include_top=False,
            weights=None,
            input_shape=(224, 224, 3),
        )
    )
    model.add(keras.layers.GlobalAveragePooling2D())
    model.add(keras.layers.Dropout(0.25))
    model.add(keras.layers.Dense(2, activation="softmax"))
    model.build((None, 224, 224, 3))
    return model


def build_efficientnet_weights_model(tf_module):
    keras = tf_module.keras
    inputs = keras.Input(shape=(224, 224, 3), name="input")
    x = keras.layers.Rescaling(1.0 / 127.5, offset=-1)(inputs)
    base = keras.applications.EfficientNetB0(
        include_top=False,
        weights=None,
        input_tensor=x,
        pooling="avg",
    )
    x = keras.layers.Dropout(0.25)(base.output)
    outputs = keras.layers.Dense(2, activation="softmax", name="fatigue_logits")(x)
    return keras.Model(inputs=inputs, outputs=outputs, name="fatigue_binary")


def export_onnx(tf_module, tf2onnx_module, model, output_path: Path) -> None:
    spec = (tf_module.TensorSpec((None, 224, 224, 3), tf_module.float32, name="input"),)
    tf2onnx_module.convert.from_keras(
        model,
        input_signature=spec,
        output_path=str(output_path),
        opset=13,
    )


def main() -> int:
    try:
        import tensorflow as tf
        import tf2onnx
    except Exception as exc:  # noqa: BLE001
        print("Missing conversion dependencies. Install with:")
        print('  pip install "tensorflow>=2.21.0,<2.22.0" "tf2onnx>=1.16.1,<2.0.0" "onnx>=1.15.0,<2.0.0"')
        print(f"Import error: {exc}")
        return 1

    model_dir = Path(__file__).resolve().parents[1] / "models" / "fatigue_level_detection"
    model_dir.mkdir(parents=True, exist_ok=True)

    converted = 0
    primary_onnx = model_dir / "fatigue_binary.onnx"

    keras_path = model_dir / "fatigue_binary.keras"
    if keras_path.exists():
        try:
            print(f"Loading full Keras model: {keras_path.name} ...")
            model = tf.keras.models.load_model(str(keras_path))
            print(f"Converting to {primary_onnx.name} ...")
            export_onnx(tf, tf2onnx, model, primary_onnx)
            converted += 1
            print(f"OK: wrote {primary_onnx}")
        except Exception as exc:  # noqa: BLE001
            print(f"Skip: failed converting {keras_path.name}: {exc}")
    else:
        print(f"Skip: missing {keras_path.name}")

    weights_path = model_dir / "fatigue_best.weights.h5"
    if weights_path.exists() and not primary_onnx.exists():
        try:
            print(f"Loading EfficientNet weights: {weights_path.name} ...")
            model = build_efficientnet_weights_model(tf)
            model.load_weights(str(weights_path))
            print(f"Converting to {primary_onnx.name} ...")
            export_onnx(tf, tf2onnx, model, primary_onnx)
            converted += 1
            print(f"OK: wrote {primary_onnx}")
        except Exception as exc:  # noqa: BLE001
            print(f"Skip: failed converting {weights_path.name}: {exc}")
    elif not weights_path.exists():
        print(f"Skip: missing {weights_path.name}")

    legacy_pairs = [
        ("model_random.h5", "model_random.onnx"),
        ("model_split.h5", "model_split.onnx"),
    ]
    for h5_name, onnx_name in legacy_pairs:
        h5_path = model_dir / h5_name
        onnx_path = model_dir / onnx_name
        if not h5_path.exists():
            print(f"Skip: missing {h5_path.name}")
            continue
        try:
            print(f"Loading legacy weights: {h5_path.name} ...")
            model = build_mobilenet_weights_model(tf)
            model.load_weights(str(h5_path))
            print(f"Converting to {onnx_path.name} ...")
            export_onnx(tf, tf2onnx, model, onnx_path)
            converted += 1
            print(f"OK: wrote {onnx_path}")
        except Exception as exc:  # noqa: BLE001
            print(f"Skip: failed converting {h5_path.name}: {exc}")

    if primary_onnx.exists():
        for alias in ("model_random.onnx", "model_split.onnx"):
            alias_path = model_dir / alias
            if alias_path.exists():
                continue
            alias_path.write_bytes(primary_onnx.read_bytes())
            print(f"OK: wrote alias {alias_path}")

    if converted == 0:
        print("No models converted.")
        return 1

    print(f"Done. Converted {converted} model(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
