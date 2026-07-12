// Package storage menyimpan berkas media (foto halaman, dsb) secara lokal
// di disk. Ini cocok untuk pengembangan satu perangkat; docs/architecture.md
// mencatat agar tidak bergantung pada penyimpanan lokal tunggal bila sistem
// dipakai dari lebih dari satu perangkat — object storage (S3-compatible)
// adalah langkah lanjutan yang disarankan untuk produksi.
package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

const OriginalsDir = "storage/originals"

type SavedFile struct {
	FilePath       string // relatif terhadap root backend, disimpan ke media_assets.file_path
	FileName       string
	FileSize       int64
	ChecksumSHA256 string
}

// SaveOriginal menulis data ke storage/originals/{scope}/{uuid}{ext} dan
// mengembalikan metadata untuk disimpan ke media_assets.
func SaveOriginal(scope string, data []byte, ext string) (SavedFile, error) {
	dir := filepath.Join(OriginalsDir, scope)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return SavedFile{}, fmt.Errorf("create dir: %w", err)
	}

	fileName := uuid.NewString() + ext
	fullPath := filepath.Join(dir, fileName)

	if err := os.WriteFile(fullPath, data, 0o644); err != nil {
		return SavedFile{}, fmt.Errorf("write file: %w", err)
	}

	sum := sha256.Sum256(data)

	return SavedFile{
		FilePath:       fullPath,
		FileName:       fileName,
		FileSize:       int64(len(data)),
		ChecksumSHA256: hex.EncodeToString(sum[:]),
	}, nil
}
