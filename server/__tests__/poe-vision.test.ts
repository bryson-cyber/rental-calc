import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  analyzeImageWithPoe, 
  analyzeMultipleImagesWithPoe,
  analyzeListingPhoto,
  analyzeCompetitorPhotos,
  testPoeVisionConnection,
  VISION_MODEL 
} from '../poe-ai';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Poe Vision API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment
    process.env.POE_API_KEY = 'test-api-key';
  });

  describe('analyzeImageWithPoe', () => {
    it('should analyze an image with Gemini 3 Pro', async () => {
      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'Gemini-3-Pro',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a modern living room with natural lighting.'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await analyzeImageWithPoe(
        'https://example.com/test-image.jpg',
        'Describe this image'
      );

      expect(result).toBe('This is a modern living room with natural lighting.');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.poe.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          })
        })
      );

      // Verify the request body contains multimodal content
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('Gemini-3-Pro');
      expect(body.stream).toBe(false);
      expect(body.messages[1].content).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'text' }),
        expect.objectContaining({ type: 'image_url' })
      ]));
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: 'Invalid image URL' } })
      });

      await expect(
        analyzeImageWithPoe('invalid-url', 'Describe this')
      ).rejects.toThrow('Invalid image URL');
    });

    it('should handle timeout', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 100);
        })
      );

      await expect(
        analyzeImageWithPoe('https://example.com/image.jpg', 'Describe', { timeoutMs: 50 })
      ).rejects.toThrow('timeout');
    });
  });

  describe('analyzeListingPhoto', () => {
    it('should return structured photo analysis', async () => {
      const mockAnalysis = {
        quality_score: 8,
        design_themes: ['Modern', 'Minimalist'],
        visible_amenities: ['Smart TV', 'Kitchen'],
        guest_appeal: 'Perfect for business travelers',
        improvement_suggestions: ['Add more plants'],
        professional_quality: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'Gemini-3-Pro',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify(mockAnalysis)
            },
            finish_reason: 'stop'
          }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
        })
      });

      const result = await analyzeListingPhoto('https://example.com/listing.jpg', {
        propertyType: 'Apartment',
        bedrooms: 2,
        location: 'Downtown'
      });

      expect(result.quality_score).toBe(8);
      expect(result.design_themes).toContain('Modern');
      expect(result.professional_quality).toBe(true);
    });
  });

  describe('analyzeCompetitorPhotos', () => {
    it('should analyze multiple competitor photos', async () => {
      const mockAnalysis = {
        common_themes: ['Modern', 'Luxury'],
        quality_benchmark: 7,
        standout_features: ['Pool', 'City View'],
        market_expectations: 'Guests expect high-end finishes',
        recommendations: ['Add professional photos', 'Highlight unique amenities']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'Gemini-3-Pro',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify(mockAnalysis)
            },
            finish_reason: 'stop'
          }],
          usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 }
        })
      });

      const result = await analyzeCompetitorPhotos(
        ['https://example.com/comp1.jpg', 'https://example.com/comp2.jpg'],
        'Downtown Seattle'
      );

      expect(result.common_themes).toContain('Modern');
      expect(result.quality_benchmark).toBe(7);
      expect(result.recommendations).toHaveLength(2);
    });
  });

  describe('testPoeVisionConnection', () => {
    it('should return success when API is working', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'Gemini-3-Pro',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a test image showing transparency.'
            },
            finish_reason: 'stop'
          }],
          usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
        })
      });

      const result = await testPoeVisionConnection();

      expect(result.success).toBe(true);
      expect(result.model).toBe(VISION_MODEL);
    });

    it('should return failure when API is not working', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await testPoeVisionConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
    });
  });
});

describe('Vision Model Configuration', () => {
  it('should use Gemini-3-Pro as the vision model', () => {
    expect(VISION_MODEL).toBe('Gemini-3-Pro');
  });
});
