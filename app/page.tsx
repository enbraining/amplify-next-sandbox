"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getUrl, list, uploadData, remove } from "aws-amplify/storage";

interface ImageItem {
  key: string;
  url: string;
  size?: number;
  lastModified?: Date;
}

export default function ImageGalleryPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 이미지 목록 불러오기
  const loadImages = async () => {
    try {
      setLoading(true);
      const allImages: ImageItem[] = [];

      // Storage에서 이미지 목록 가져오기 (페이지네이션)
      let hasNextPage = true;
      let nextToken: string | undefined = undefined;

      while (hasNextPage) {
        const result: any = await list({
          path: "images/",
          options: {
            pageSize: 100, // 한 번에 가져올 개수
            nextToken,
          },
        });

        // 이미지 파일만 필터링
        const imageFiles = result.items.filter((item: any) => {
          const path = item.path.toLowerCase();
          return (
            path.endsWith(".jpg") ||
            path.endsWith(".jpeg") ||
            path.endsWith(".png") ||
            path.endsWith(".gif") ||
            path.endsWith(".webp")
          );
        });

        // 각 이미지의 URL 가져오기
        const imagesWithUrls = await Promise.all(
          imageFiles.map(async (item: any) => {
            const urlResult = await getUrl({
              path: item.path,
              options: {
                expiresIn: 3600, // 1시간
              },
            });

            return {
              key: item.path,
              url: urlResult.url.toString(),
              size: item.size,
              lastModified: item.lastModified,
            };
          })
        );

        allImages.push(...imagesWithUrls);

        // 다음 페이지 확인
        hasNextPage = !!result.nextToken;
        nextToken = result.nextToken;
      }

      setImages(allImages);
    } catch (error) {
      console.error("이미지 로드 실패:", error);
      alert("이미지 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 이미지 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;
      const path = `images/${fileName}`;

      await uploadData({
        path,
        data: file,
        options: {
          contentType: file.type,
          onProgress: ({ transferredBytes, totalBytes }) => {
            if (totalBytes) {
              const percentage = Math.round(
                (transferredBytes / totalBytes) * 100
              );
              setUploadProgress(percentage);
            }
          },
        },
      }).result;

      alert("업로드 완료!");
      await loadImages(); // 목록 새로고침

      // 파일 입력 초기화
      e.target.value = "";
    } catch (error) {
      console.error("업로드 실패:", error);
      alert("업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // 이미지 삭제
  const handleDelete = async (path: string) => {
    if (!confirm("이 이미지를 삭제하시겠습니까?")) return;

    try {
      await remove({
        path,
      });

      alert("삭제 완료!");
      await loadImages(); // 목록 새로고침
    } catch (error) {
      console.error("삭제 실패:", error);
      alert("삭제에 실패했습니다.");
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            📸 Amplify Storage 이미지 갤러리
          </h1>

          {/* 업로드 섹션 */}
          <div className="mb-4">
            <label className="inline-block">
              <span className="sr-only">파일 선택</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </label>
          </div>

          {/* 업로드 프로그레스 */}
          {uploading && (
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-indigo-700">
                  업로드 중...
                </span>
                <span className="text-sm font-medium text-indigo-700">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* 통계 */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>📁 총 {images.length}개의 이미지</span>
            <button
              onClick={loadImages}
              disabled={loading}
              className="text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
            >
              🔄 새로고침
            </button>
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
              <p className="text-gray-600">이미지 불러오는 중...</p>
            </div>
          </div>
        )}

        {/* 이미지 없음 */}
        {!loading && images.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🖼️</div>
            <p className="text-gray-600 text-lg mb-2">
              아직 업로드된 이미지가 없습니다
            </p>
            <p className="text-gray-500 text-sm">
              위에서 이미지를 업로드해보세요!
            </p>
          </div>
        )}

        {/* 이미지 그리드 */}
        {!loading && images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map((image) => (
              <div
                key={image.key}
                className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* 이미지 */}
                <div className="aspect-square relative bg-gray-100">
                  <Image
                    src={image.url}
                    alt={image.key.split("/").pop() || "이미지"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    unoptimized // Amplify signed URL
                  />
                </div>

                {/* 정보 */}
                <div className="p-4">
                  <p
                    className="text-sm text-gray-800 font-medium truncate mb-2"
                    title={image.key.split("/").pop()}
                  >
                    {image.key.split("/").pop()}
                  </p>

                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <div>
                      {image.size && <p>{(image.size / 1024).toFixed(1)} KB</p>}
                      {image.lastModified && (
                        <p>
                          {new Date(image.lastModified).toLocaleDateString(
                            "ko-KR"
                          )}
                        </p>
                      )}
                    </div>

                    {/* 삭제 버튼 */}
                    <button
                      onClick={() => handleDelete(image.key)}
                      className="text-red-500 hover:text-red-700 font-medium"
                      title="삭제"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
