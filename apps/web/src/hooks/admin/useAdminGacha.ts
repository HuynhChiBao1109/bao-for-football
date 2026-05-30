import { useMutation } from '@tanstack/react-query';
import { API_BASE_URL } from '../../lib/apiClient';

type CreateBannerInput = {
  token: string;
  playerId: number;
  playerName: string;
  timeEnd: string;
  bannerFile: File;
};

export function useCreateAdminGachaBanner() {
  return useMutation<void, Error, CreateBannerInput>({
    mutationFn: async ({ token, playerId, playerName, timeEnd, bannerFile }) => {
      const expiresAt = new Date(timeEnd);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new Error('timeEnd không hợp lệ');
      }

      const formData = new FormData();
      formData.append('image', bannerFile);

      const uploadResponse = await fetch(`${API_BASE_URL}/api/v1/admin/uploads/image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadData?.message || uploadData?.error || 'Không thể upload ảnh banner');
      }

      const payload = {
        bannerCode: `gacha-${playerId}-${Date.now()}`,
        bannerName: `${playerName || 'Player'} Banner`,
        playerId,
        bannerImageUrl: uploadData?.data?.url || uploadData?.url || '',
        timeEnd: expiresAt.toISOString(),
      };

      const createResponse = await fetch(`${API_BASE_URL}/api/v1/admin/gacha/banners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const createData = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(createData?.message || createData?.error || 'Không thể tạo banner gacha');
      }
    },
  });
}
