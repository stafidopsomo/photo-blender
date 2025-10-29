const { generateRoomCode, sanitizePlayerName } = require('./helpers');

describe('generateRoomCode', () => {
  test('should generate a 6-digit numeric code', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  test('should generate codes between 100000 and 999999', () => {
    const code = generateRoomCode();
    const numericCode = parseInt(code, 10);
    expect(numericCode).toBeGreaterThanOrEqual(100000);
    expect(numericCode).toBeLessThan(1000000);
  });

  test('should generate unique codes (statistical test)', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateRoomCode());
    }
    // With 100 iterations, we should have at least 95 unique codes
    // (allowing for some collisions in the random space)
    expect(codes.size).toBeGreaterThan(95);
  });

  test('should always return a string', () => {
    const code = generateRoomCode();
    expect(typeof code).toBe('string');
  });
});

describe('sanitizePlayerName', () => {
  test('should remove HTML tags from player name', () => {
    const malicious = '<script>alert("xss")</script>John';
    const sanitized = sanitizePlayerName(malicious);
    expect(sanitized).toBe('John');
    expect(sanitized).not.toContain('<script>');
  });

  test('should remove all HTML attributes', () => {
    const malicious = '<img src="x" onerror="alert(1)">Bob';
    const sanitized = sanitizePlayerName(malicious);
    expect(sanitized).toBe('Bob');
    expect(sanitized).not.toContain('onerror');
  });

  test('should trim whitespace', () => {
    const name = '   Alice   ';
    const sanitized = sanitizePlayerName(name);
    expect(sanitized).toBe('Alice');
  });

  test('should limit length to 20 characters', () => {
    const longName = 'A'.repeat(50);
    const sanitized = sanitizePlayerName(longName);
    expect(sanitized.length).toBe(20);
  });

  test('should handle empty strings', () => {
    expect(sanitizePlayerName('')).toBe('');
    expect(sanitizePlayerName('   ')).toBe('');
  });

  test('should handle null and undefined', () => {
    expect(sanitizePlayerName(null)).toBe('');
    expect(sanitizePlayerName(undefined)).toBe('');
  });

  test('should handle non-string input', () => {
    expect(sanitizePlayerName(123)).toBe('');
    expect(sanitizePlayerName({})).toBe('');
    expect(sanitizePlayerName([])).toBe('');
  });

  test('should allow valid alphanumeric names', () => {
    expect(sanitizePlayerName('John123')).toBe('John123');
    expect(sanitizePlayerName('Alice_Bob')).toBe('Alice_Bob');
  });

  test('should handle unicode characters safely', () => {
    const unicodeName = 'José';
    const sanitized = sanitizePlayerName(unicodeName);
    expect(sanitized).toBe('José');
  });

  test('should prevent XSS via javascript: protocol', () => {
    const malicious = '<a href="javascript:alert(1)">Click</a>';
    const sanitized = sanitizePlayerName(malicious);
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('<a');
  });

  test('should handle nested HTML tags', () => {
    const malicious = '<div><span><b>Test</b></span></div>';
    const sanitized = sanitizePlayerName(malicious);
    expect(sanitized).toBe('Test');
  });

  test('should handle special characters in names', () => {
    expect(sanitizePlayerName('John-Doe')).toBe('John-Doe');
    expect(sanitizePlayerName("O'Brien")).toBe("O'Brien");
  });
});
