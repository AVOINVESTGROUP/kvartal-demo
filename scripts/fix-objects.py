#!/usr/bin/env python3
"""Fix encoding issues in new objects and replace default images."""
import json, subprocess, urllib.request, urllib.error

BASE = "https://kvartal-office-api-544286782827.europe-west4.run.app"
ADMIN_TOKEN = "gKCble7RWMvmi3kwHPs5BVd9hQTztxyFLnE08XcfAuUD4qoO6jGYr2J1ZapNIS"

def get_identity_token():
    result = subprocess.run(["gcloud", "auth", "print-identity-token"], capture_output=True, text=True)
    return result.stdout.strip()

def api(method, path, body=None, token=""):
    url = BASE + path
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("x-kvartal-admin-write-token", ADMIN_TOKEN)
    if data:
        req.add_header("Content-Type", "application/json; charset=utf-8")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

TOKEN = get_identity_token()
print("Token obtained:", TOKEN[:20] + "...")

# Objects to fix: id -> patch payload
patches = [
    # Dubai new objects (encoding broken)
    ("cmpxpifi00002vgf", {
        "title": "Люкс-апартаменты в Дубай Марина",
        "titleEn": "Luxury Penthouse Dubai Marina",
        "description": "Апартаменты премиум-класса с видом на Марину и Персидский залив. Закрытый комплекс, бассейн, консьерж-сервис.",
        "descriptionEn": "Premium penthouse with full Marina and Gulf views. Gated complex with infinity pool and concierge service.",
        "addressDisplay": "Дубай, Dubai Marina, Tower 42",
        "addressDisplayEn": "Dubai Marina, Tower 42, Dubai",
    }),
    ("cmpxpifvz0008vgf", {
        "title": "Вилла на Palm Jumeirah",
        "titleEn": "Palm Jumeirah Private Villa",
        "description": "Отдельно стоящая вилла на острове Palm Jumeirah. Частный пляж, бассейн, 5 спален.",
        "descriptionEn": "Standalone villa on Palm Jumeirah with private beach, pool and 5 bedrooms.",
        "addressDisplay": "Дубай, Palm Jumeirah, Frond K",
        "addressDisplayEn": "Palm Jumeirah, Frond K, Dubai",
    }),
    # Yerevan new objects (encoding broken)
    ("cmpxpkwul000evgf", {
        "title": "Апартаменты в центре Еревана",
        "titleEn": "Modern Apartment in Central Yerevan",
        "description": "Современные апартаменты в историческом центре Еревана. Панорамный вид на Арарат, высокий потолок, дизайнерский ремонт.",
        "descriptionEn": "Modern apartment in historic central Yerevan with panoramic Ararat view, high ceilings and designer finish.",
        "addressDisplay": "Ереван, Кентрон, проспект Баграмяна",
        "addressDisplayEn": "Kentron, Baghramyan Avenue, Yerevan",
    }),
    ("cmpxpkx82000kvgf", {
        "title": "Инвестиционный жилой комплекс",
        "titleEn": "Residential Investment Complex Yerevan",
        "description": "Строящийся жилой комплекс бизнес-класса в Ереване. Сдача 2026, гарантированная доходность, возможность ВНЖ Армении.",
        "descriptionEn": "Business-class residential complex under construction. Completion 2026, guaranteed yield, Armenian residency option.",
        "addressDisplay": "Ереван, район Аван",
        "addressDisplayEn": "Avan District, Yerevan",
    }),
    # Tbilisi new objects (encoding broken)
    ("cmpxpm5ds000qvgf", {
        "title": "Апартаменты в Старом городе Тбилиси",
        "titleEn": "Old Town Tbilisi Heritage Apartment",
        "description": "Уникальные апартаменты в историческом Старом городе. Отреставрированный особняк, балкон с видом на реку Куру, аутентичный дизайн.",
        "descriptionEn": "Unique apartment in historic Old Town Tbilisi. Restored mansion with balcony overlooking the Kura river.",
        "addressDisplay": "Тбилиси, Старый город, район Абанотубани",
        "addressDisplayEn": "Abanotubani District, Old Town, Tbilisi",
    }),
    ("cmpxpm5r2000wvgf", {
        "title": "Апартаменты бизнес-класса, Ваке",
        "titleEn": "Business Class Apartment, Vake District",
        "description": "Современный жилой комплекс в престижном районе Ваке. Подземный паркинг, консьерж, фитнес-зал, управляемая аренда.",
        "descriptionEn": "Modern residential complex in prestigious Vake district. Underground parking, concierge, gym and managed rental.",
        "addressDisplay": "Тбилиси, Ваке, проспект Важа-Пшавела",
        "addressDisplayEn": "Vake, Vazha-Pshavela Avenue, Tbilisi",
    }),
    # Original objects — replace default image
    ("cmpq89lli001zkhr", {
        "mediaUrl": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=900&q=85",
    }),
    ("cmpq89lm70028khr", {
        "mediaUrl": "https://images.unsplash.com/photo-1553899017-4f6c8e14b73e?w=900&q=85",
    }),
    ("cmpq89lko001qkhr", {
        "mediaUrl": "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=900&q=85",
    }),
    # KVARTAL Moscow — replace default images
    ("cmpq85g0q001z39h", {
        "mediaUrl": "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=900&q=85",
    }),
    ("cmpq85fvd000q39h", {
        "mediaUrl": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=85",
    }),
]

for obj_id, payload in patches:
    payload["organizationSlug"] = "auto"  # will be ignored but required
    payload["objectId"] = obj_id
    try:
        result = api("PATCH", f"/api/v1/admin/objects/{obj_id}", payload, TOKEN)
        print(f"✓ {obj_id[:12]} — {result.get('ok')}")
    except Exception as e:
        print(f"✗ {obj_id[:12]} — {e}")
