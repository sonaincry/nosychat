export type GiphyMediaType = 'Gif' | 'Sticker';

export interface GiphyMediaItem {
  id: string;
  title: string;
  previewUrl: string;
  mediaUrl: string;
  width: number;
  height: number;
}

interface GiphyImage {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
}

interface GiphyResponseItem {
  id: string;
  title?: string;
  images: {
    fixed_width?: GiphyImage;
    fixed_width_small?: GiphyImage;
    downsized_medium?: GiphyImage;
    original?: GiphyImage;
  };
}

interface GiphyResponse {
  data: GiphyResponseItem[];
}

const GIPHY_API_URL = 'https://api.giphy.com/v1';
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY as string | undefined;

export const hasGiphyApiKey = Boolean(GIPHY_API_KEY);

export async function getGiphyMedia(type: GiphyMediaType, query: string, signal?: AbortSignal) {
  if (!GIPHY_API_KEY) throw new Error('GIPHY chưa được cấu hình.');

  const collection = type === 'Sticker' ? 'stickers' : 'gifs';
  const action = query.trim() ? 'search' : 'trending';
  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    limit: '24',
    rating: 'pg-13',
    lang: 'vi',
  });
  if (query.trim()) params.set('q', query.trim());
  if (type === 'Sticker') params.set('remove_low_contrast', 'true');

  const response = await fetch(`${GIPHY_API_URL}/${collection}/${action}?${params}`, { signal });
  if (!response.ok) throw new Error('Không tải được nội dung từ GIPHY.');

  const result = await response.json() as GiphyResponse;
  return result.data.flatMap<GiphyMediaItem>(item => {
    const preview = item.images.fixed_width_small ?? item.images.fixed_width;
    const media = item.images.downsized_medium ?? item.images.fixed_width ?? item.images.original;
    const previewUrl = preview?.webp ?? preview?.url;
    const mediaUrl = media?.webp ?? media?.url;
    if (!previewUrl || !mediaUrl) return [];
    return [{
      id: item.id,
      title: item.title || (type === 'Sticker' ? 'GIPHY Sticker' : 'GIPHY GIF'),
      previewUrl,
      mediaUrl,
      width: Number(media?.width) || 200,
      height: Number(media?.height) || 200,
    }];
  });
}
