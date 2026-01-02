import { describe, it, expect } from 'vitest';

describe('Competitor Imagery Analysis', () => {
  it('should correctly calculate average image count', () => {
    const imageCounts = [25, 30, 15, 20, 35];
    const avgImageCount = imageCounts.reduce((a, b) => a + b, 0) / imageCounts.length;
    expect(avgImageCount).toBe(25);
  });

  it('should correctly identify max and min image counts', () => {
    const imageCounts = [25, 30, 15, 20, 35];
    const maxImageCount = Math.max(...imageCounts);
    const minImageCount = Math.min(...imageCounts);
    expect(maxImageCount).toBe(35);
    expect(minImageCount).toBe(15);
  });

  it('should correctly determine high photo threshold', () => {
    const avgImageCount = 20;
    const highPhotoThreshold = Math.ceil(avgImageCount * 1.5);
    expect(highPhotoThreshold).toBe(30);
  });

  it('should correctly count competitors above threshold', () => {
    const imageCounts = [25, 30, 15, 20, 35, 40];
    const highPhotoThreshold = 30;
    const aboveThreshold = imageCounts.filter(c => c >= highPhotoThreshold).length;
    expect(aboveThreshold).toBe(3); // 30, 35, 40
  });

  it('should correctly identify professional photos (20+ images)', () => {
    const testCases = [
      { imageCount: 25, expected: true },
      { imageCount: 20, expected: true },
      { imageCount: 19, expected: false },
      { imageCount: 10, expected: false }
    ];
    
    testCases.forEach(({ imageCount, expected }) => {
      const hasProfessionalPhotos = imageCount >= 20;
      expect(hasProfessionalPhotos).toBe(expected);
    });
  });

  it('should generate correct recommendation based on average photo count', () => {
    const testCases = [
      { avgImageCount: 30, expected: 'Market expects professional photography with 25+ high-quality images' },
      { avgImageCount: 25, expected: 'Market expects professional photography with 25+ high-quality images' },
      { avgImageCount: 20, expected: 'Aim for 20+ photos to match top competitors' },
      { avgImageCount: 15, expected: 'Aim for 20+ photos to match top competitors' },
      { avgImageCount: 10, expected: 'Basic photography may suffice, but quality images still help' }
    ];
    
    testCases.forEach(({ avgImageCount, expected }) => {
      const recommendation = avgImageCount >= 25 
        ? 'Market expects professional photography with 25+ high-quality images'
        : avgImageCount >= 15
        ? 'Aim for 20+ photos to match top competitors'
        : 'Basic photography may suffice, but quality images still help';
      expect(recommendation).toBe(expected);
    });
  });

  it('should format competitor image data correctly', () => {
    const competitorImageData = [
      { name: 'Luxury Downtown Condo', image_count: 35, has_professional_photos: true },
      { name: 'Cozy Studio', image_count: 15, has_professional_photos: false }
    ];
    
    const formatted = competitorImageData
      .map(c => `- ${c.name}: ${c.image_count} photos${c.has_professional_photos ? ' (professional quality)' : ''}`)
      .join('\n');
    
    expect(formatted).toContain('Luxury Downtown Condo: 35 photos (professional quality)');
    expect(formatted).toContain('Cozy Studio: 15 photos');
    expect(formatted).not.toContain('Cozy Studio: 15 photos (professional quality)');
  });

  it('should extract property ID from Airbnb URL', () => {
    const testCases = [
      { url: 'https://www.airbnb.com/rooms/12345678', expected: '12345678' },
      { url: 'https://airbnb.com/rooms/87654321?check_in=2024-01-01', expected: '87654321' },
      { url: 'https://www.airbnb.com/rooms/11111111/photos', expected: '11111111' },
      { url: null, expected: null }
    ];
    
    testCases.forEach(({ url, expected }) => {
      const match = url?.match(/rooms\/(\d+)/);
      const propId = match ? match[1] : null;
      expect(propId).toBe(expected);
    });
  });
});
