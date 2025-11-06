"use client";
import { useState, useEffect } from "react";
import "@/app/app.css";
import "@aws-amplify/ui-react/styles.css";
import { uploadData, getUrl, list, remove } from "aws-amplify/storage";
import Image from "next/image";

interface ImageItem {
  path: string;
  url: string;
  size?: number;
  lastModified?: Date;
}

export default function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadingImages, setLoadingImages] = useState(false);

  async function loadImages() {
    try {
      setLoadingImages(true);
      const allImages: ImageItem[] = [];

      // Storage에서 이미지 목록 가져오기 (페이지네이션)
      let hasNextPage = true;
      let nextToken: string | undefined = undefined;

      while (hasNextPage) {
        const result: any = await list({
          path: "images/",
          options: {
            pageSize: 100,
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
              path: item.path,
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
      setLoadingImages(false);
    }
  }

  useEffect(() => {
    loadImages();
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
  }

  async function handleDeleteImage(path: string) {
    if (!confirm("이 이미지를 삭제하시겠습니까?")) return;

    try {
      await remove({ path });
      alert("삭제 완료!");
      await loadImages(); // 목록 새로고침
    } catch (error) {
      console.error("삭제 실패:", error);
      alert("삭제에 실패했습니다.");
    }
  }

  return (
    <main className="container">
      {/* 이미지 업로드 섹션 */}
      <section className="image-section">
        <h1>📸 이미지 갤러리</h1>

        {/* 업로드 UI */}
        <div className="upload-container">
          <label htmlFor="file-upload" className="upload-label">
            {uploading ? "업로드 중..." : "이미지 선택"}
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            className="file-input"
          />

          {/* 업로드 프로그레스 */}
          {uploading && (
            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="progress-text">{uploadProgress}%</span>
            </div>
          )}

          <button
            onClick={loadImages}
            disabled={loadingImages}
            className="refresh-button"
          >
            {loadingImages ? "로딩 중..." : "🔄 새로고침"}
          </button>

          <span className="image-count">총 {images.length}개의 이미지</span>
        </div>

        {/* 이미지 그리드 */}
        {loadingImages ? (
          <div className="loading">이미지 불러오는 중...</div>
        ) : images.length === 0 ? (
          <div className="empty-state">
            <p>📁 업로드된 이미지가 없습니다</p>
            <p className="empty-hint">위에서 이미지를 업로드해보세요!</p>
          </div>
        ) : (
          <div className="image-grid">
            {images.map((image) => (
              <div key={image.path} className="image-card">
                <div className="image-wrapper">
                  <Image
                    src={image.url}
                    alt={image.path.split("/").pop() || "이미지"}
                    fill
                    className="image"
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    unoptimized
                  />
                </div>

                <div className="image-info">
                  <p className="image-name" title={image.path.split("/").pop()}>
                    {image.path.split("/").pop()}
                  </p>

                  <div className="image-meta">
                    {image.size && (
                      <span className="image-size">
                        {(image.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                    {image.lastModified && (
                      <span className="image-date">
                        {new Date(image.lastModified).toLocaleDateString(
                          "ko-KR"
                        )}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteImage(image.path)}
                    className="delete-button"
                  >
                    🗑️ 삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
