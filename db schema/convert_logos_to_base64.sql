UPDATE teams SET logo_url =
  'data:image/svg+xml;base64,' || encode(
    ('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="45" fill="#4F46E5"/><text x="50" y="60" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="white" text-anchor="middle">' ||
    UPPER(SUBSTRING(short_code, 1, 2)) ||
    '</text></svg>')::bytea,
    'base64'
  )
WHERE logo_url IS NULL OR logo_url = '' OR logo_url NOT LIKE 'data:image%';

