UPDATE "PropertyMedia" pm
SET
  "url" = CASE po."title"
    WHEN 'Коммерческий объект в Москве' THEN 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=82'
    WHEN 'Участок, Истринский район, Холщевики' THEN 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=82'
    WHEN 'Премиальная квартира в Тбилиси' THEN 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=82'
    WHEN 'Девелоперский проект в Дубае' THEN 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1000&q=82'
    WHEN 'Земельный участок в Ереване' THEN 'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?auto=format&fit=crop&w=1000&q=82'
    ELSE pm."url"
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "PropertyObject" po
WHERE pm."propertyObjectId" = po."id"
  AND pm."url" = '/images/hero-moscow-dubai.png'
  AND pm."kind" = 'image'
  AND po."title" IN (
    'Коммерческий объект в Москве',
    'Участок, Истринский район, Холщевики',
    'Премиальная квартира в Тбилиси',
    'Девелоперский проект в Дубае',
    'Земельный участок в Ереване'
  );
