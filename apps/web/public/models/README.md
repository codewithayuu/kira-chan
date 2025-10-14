# Live2D Models

This directory contains Live2D model files for the AI companion avatar.

## Getting Started

1. Download a Live2D model from [Live2D Cubism Sample Data](https://www.live2d.com/en/download/sample-data/)
2. Extract the model files to a subdirectory (e.g., `hiyori/`)
3. Update the model path in `Live2DAvatar.tsx` if needed

## Model Structure

A typical Live2D model directory should contain:
- `.model3.json` - Model configuration file
- `.moc3` - Model data file
- `.motion3.json` - Motion data files
- `.physics3.json` - Physics data file
- `.cdi3.json` - Display information file
- `.userdata3.json` - User data file
- Texture files (`.png`)

## Example: Hiyori Model

```
models/
└── hiyori/
    ├── hiyori_free_t08.model3.json
    ├── hiyori_free_t08.moc3
    ├── motions/
    │   ├── idle.motion3.json
    │   ├── happy.motion3.json
    │   └── sad.motion3.json
    ├── physics/
    │   └── hiyori_free_t08.physics3.json
    └── textures/
        └── hiyori_free_t08.1024.png
```

## Custom Models

To use your own Live2D model:

1. Export your model from Live2D Cubism Editor
2. Place all files in a new subdirectory
3. Update the model path in the code:

```typescript
const modelPath = '/models/your-model/your-model.model3.json';
```

## Parameters

Common Live2D parameters for lip-sync:
- `PARAM_MOUTH_OPEN_Y` - Mouth opening (0-1)
- `PARAM_EYE_L_OPEN` - Left eye opening (0-1)
- `PARAM_EYE_R_OPEN` - Right eye opening (0-1)
- `PARAM_ANGLE_X` - Head rotation X
- `PARAM_ANGLE_Y` - Head rotation Y
- `PARAM_ANGLE_Z` - Head rotation Z

## License

Make sure to check the license of any Live2D models you use. Sample models from Live2D are typically free for non-commercial use.

## Troubleshooting

- **Model not loading**: Check that all required files are present
- **Textures not showing**: Ensure texture files are in the correct format and location
- **Animations not working**: Verify motion files are properly referenced
- **Physics not working**: Check physics configuration file

For more information, see the [Live2D Cubism documentation](https://docs.live2d.com/).
