jest.mock('replicate', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import { ReplicateGenerationProvider } from './replicate-generation.provider';

const MockReplicate = jest.requireMock('replicate').default as jest.Mock;

describe('ReplicateGenerationProvider', () => {
  const originalEnv = { ...process.env };
  const mockCreate = jest.fn();
  const mockGet = jest.fn();

  beforeEach(() => {
    process.env.REPLICATE_API_TOKEN = 'token-123';
    process.env.REPLICATE_MODEL = 'wan-video/wan-2.2-animate-replace';
    process.env.REPLICATE_VIDEO_INPUT_KEY = 'video';
    process.env.REPLICATE_CHARACTER_IMAGE_KEY = 'character_image';
    process.env.REPLICATE_PROMPT_INPUT_KEY = 'prompt';
    process.env.REPLICATE_EXTRA_INPUT_JSON = '{"go_fast":true}';

    mockCreate.mockReset();
    mockGet.mockReset();
    mockCreate.mockResolvedValue({ id: 'pred-1', status: 'starting' });
    mockGet.mockResolvedValue({
      status: 'succeeded',
      output: [{ url: 'https://cdn.example.com/out.mp4' }],
    });
    MockReplicate.mockImplementation(() => ({
      predictions: {
        create: mockCreate,
        get: mockGet,
      },
    }));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('submits video and character image Buffers via Replicate SDK (ai_video_demo pattern)', async () => {
    const provider = new ReplicateGenerationProvider();
    const video = Buffer.from('fake-video');
    const characterImage = Buffer.from('fake-image');

    const result = await provider.createPrediction({
      video,
      characterImage,
      prompt: 'replace character',
    });

    expect(result).toEqual({
      predictionId: 'pred-1',
      status: 'starting',
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'wan-video/wan-2.2-animate-replace',
        input: expect.objectContaining({
          video,
          character_image: characterImage,
          prompt: 'replace character',
          go_fast: true,
        }),
      }),
    );
  });

  it('normalizes output url when polling via SDK', async () => {
    const provider = new ReplicateGenerationProvider();
    const result = await provider.getPrediction('pred-2');
    expect(mockGet).toHaveBeenCalledWith('pred-2');
    expect(result.status).toBe('succeeded');
    expect(result.outputUrl).toBe('https://cdn.example.com/out.mp4');
  });
});
