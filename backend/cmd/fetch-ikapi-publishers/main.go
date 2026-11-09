package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultEndpoint = "https://www.ikapi.org/wp-json/custom-api/v1/anggota"
	sourcePage      = "https://www.ikapi.org/anggota-ikapi/"
)

type ikapiResponse struct {
	Data       []ikapiMember `json:"data"`
	TotalItems string        `json:"total_items"`
	TotalPages int           `json:"total_pages"`
}

type ikapiMember struct {
	ID            string `json:"id"`
	PublisherName string `json:"nama_penerbit"`
	MemberNumber  string `json:"nomer_anggota"`
	KTA           string `json:"kta"`
	Status        string `json:"status"`
}

func main() {
	var outPath string
	var endpoint string
	var perPage int
	var verifiedAt string
	var delay time.Duration

	flag.StringVar(&outPath, "out", "../data/import/publishers_ikapi_members_2026_05_01.csv", "path CSV output")
	flag.StringVar(&endpoint, "endpoint", defaultEndpoint, "endpoint anggota IKAPI")
	flag.IntVar(&perPage, "per-page", 500, "jumlah data per halaman")
	flag.StringVar(&verifiedAt, "verified-at", time.Now().Format("2006-01-02"), "tanggal verifikasi YYYY-MM-DD")
	flag.DurationVar(&delay, "delay", 250*time.Millisecond, "jeda antar request")
	flag.Parse()

	if perPage <= 0 {
		log.Fatal("per-page harus lebih dari 0")
	}

	ctx := context.Background()
	members, totalItems, err := fetchAll(ctx, endpoint, perPage, delay)
	if err != nil {
		log.Fatal(err)
	}
	if err := writeCSV(outPath, verifiedAt, members); err != nil {
		log.Fatal(err)
	}

	log.Printf("IKAPI members fetched: %d rows; reported total_items=%s; output=%s", len(members), totalItems, outPath)
}

func fetchAll(ctx context.Context, endpoint string, perPage int, delay time.Duration) ([]ikapiMember, string, error) {
	var members []ikapiMember
	totalPages := 1
	totalItems := ""

	for page := 1; page <= totalPages; page++ {
		response, err := fetchPage(ctx, endpoint, page, perPage)
		if err != nil {
			return nil, "", err
		}
		if response.TotalPages > 0 {
			totalPages = response.TotalPages
		}
		if response.TotalItems != "" {
			totalItems = response.TotalItems
		}
		members = append(members, response.Data...)
		if page < totalPages {
			time.Sleep(delay)
		}
	}

	if totalItems != "" {
		expected, err := strconv.Atoi(totalItems)
		if err == nil && expected != len(members) {
			return nil, "", fmt.Errorf("jumlah data tidak sesuai: endpoint=%d fetched=%d", expected, len(members))
		}
	}
	return members, totalItems, nil
}

func fetchPage(ctx context.Context, endpoint string, page int, perPage int) (ikapiResponse, error) {
	baseURL, err := url.Parse(endpoint)
	if err != nil {
		return ikapiResponse{}, fmt.Errorf("parse endpoint: %w", err)
	}
	query := baseURL.Query()
	query.Set("page", strconv.Itoa(page))
	query.Set("per_page", strconv.Itoa(perPage))
	baseURL.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL.String(), nil)
	if err != nil {
		return ikapiResponse{}, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Buddybooks data importer (+https://www.ikapi.org/anggota-ikapi/)")

	client := http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return ikapiResponse{}, fmt.Errorf("fetch page %d: %w", page, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ikapiResponse{}, fmt.Errorf("fetch page %d: status %s", page, resp.Status)
	}

	var parsed ikapiResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return ikapiResponse{}, fmt.Errorf("decode page %d: %w", page, err)
	}
	return parsed, nil
}

func writeCSV(outPath string, verifiedAt string, members []ikapiMember) error {
	file, err := os.Create(outPath)
	if err != nil {
		return fmt.Errorf("create csv: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	header := []string{
		"authorized_name",
		"alternate_names",
		"legal_name",
		"brand_name",
		"birth_or_founding_year",
		"death_or_dissolution_year",
		"website_url",
		"email",
		"phone",
		"country_id",
		"country_name",
		"city_id",
		"city_name",
		"address",
		"historical_period",
		"imprint_names",
		"publisher_category",
		"status",
		"source_url",
		"source_note",
		"verified_at",
		"confidence_level",
		"notes",
		"roles",
	}
	if err := writer.Write(header); err != nil {
		return fmt.Errorf("write header: %w", err)
	}

	for _, member := range members {
		name := cleanPublisherName(member.PublisherName)
		if name == "" {
			continue
		}

		status := ""
		if strings.EqualFold(strings.TrimSpace(member.Status), "Aktif") {
			status = "active"
		}

		sourceNote := fmt.Sprintf(
			"Direktori Anggota IKAPI per 1 Mei 2026; nomor anggota: %s; masa KTA berakhir: %s; status IKAPI: %s.",
			strings.TrimSpace(member.MemberNumber),
			strings.TrimSpace(member.KTA),
			strings.TrimSpace(member.Status),
		)

		record := []string{
			name,
			"",
			"",
			name,
			"",
			"",
			"",
			"",
			"",
			"",
			"Indonesia",
			"",
			"",
			"",
			"",
			"",
			"",
			status,
			sourcePage,
			sourceNote,
			verifiedAt,
			"high",
			"Impor resmi dari endpoint publik anggota IKAPI. Status IKAPI adalah status keanggotaan, bukan selalu status operasional penerbit.",
			"publisher",
		}
		if err := writer.Write(record); err != nil {
			return fmt.Errorf("write record %s: %w", name, err)
		}
	}
	return writer.Error()
}

func cleanPublisherName(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, `\"`, `"`)
	for {
		cleaned := strings.Trim(value, " \t\r\n\"'`“”‘’")
		if cleaned == value {
			return cleaned
		}
		value = cleaned
	}
}
