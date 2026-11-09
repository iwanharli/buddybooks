package main

import (
	"context"
	"encoding/csv"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/buddybooks/backend/internal/config"
	"github.com/buddybooks/backend/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var validRoles = map[string]bool{
	"publisher":      true,
	"printer":        true,
	"distributor":    true,
	"binder":         true,
	"author":         true,
	"editor":         true,
	"translator":     true,
	"seller":         true,
	"appraiser":      true,
	"previous_owner": true,
	"institution":    true,
	"illustrator":    true,
	"compiler":       true,
	"contributor":    true,
	"collector":      true,
	"other":          true,
}

var validStatuses = map[string]bool{
	"active":   true,
	"inactive": true,
	"closed":   true,
	"unknown":  true,
}

var validConfidenceLevels = map[string]bool{
	"":       true,
	"low":    true,
	"medium": true,
	"high":   true,
}

var validPublisherCategories = map[string]bool{
	"":                      true,
	"trade_publisher":       true,
	"university_press":      true,
	"academic_publisher":    true,
	"religious_publisher":   true,
	"media_group_publisher": true,
	"government_publisher":  true,
	"historical_publisher":  true,
	"printer":               true,
	"other":                 true,
}

type publisherRow struct {
	Line                   int
	AuthorizedName         string
	AlternateNames         string
	LegalName              string
	BrandName              string
	BirthOrFoundingYear    *int
	DeathOrDissolutionYear *int
	WebsiteURL             string
	Email                  string
	Phone                  string
	CountryID              string
	CountryName            string
	CityID                 string
	CityName               string
	Address                string
	HistoricalPeriod       string
	ImprintNames           string
	PublisherCategory      string
	Status                 string
	StatusProvided         bool
	SourceURL              string
	SourceNote             string
	VerifiedAt             *time.Time
	ConfidenceLevel        string
	ConfidenceProvided     bool
	Notes                  string
	Roles                  []string
}

type importStats struct {
	Rows     int
	Inserted int
	Updated  int
	Roles    int
	Skipped  int
	Warnings []string
}

func main() {
	var filePath string
	var dryRun bool
	flag.StringVar(&filePath, "file", "", "path CSV penerbit yang akan diimpor")
	flag.BoolVar(&dryRun, "dry-run", false, "validasi CSV tanpa menulis ke database")
	flag.Parse()

	if filePath == "" {
		log.Fatal("flag -file wajib diisi")
	}

	rows, warnings, err := readPublisherCSV(filePath)
	if err != nil {
		log.Fatal(err)
	}

	stats := importStats{Rows: len(rows), Warnings: warnings}
	if dryRun {
		stats.Skipped = len(rows)
		printStats(stats)
		return
	}

	_ = godotenv.Load(".env", "backend/.env")
	cfg := config.Load()

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	stats, err = importPublishers(ctx, pool, rows, warnings)
	if err != nil {
		log.Fatal(err)
	}
	printStats(stats)
}

func readPublisherCSV(filePath string) ([]publisherRow, []string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, nil, fmt.Errorf("open csv: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1

	header, err := reader.Read()
	if err != nil {
		return nil, nil, fmt.Errorf("read header: %w", err)
	}
	index := headerIndex(header)
	if _, ok := index["authorized_name"]; !ok {
		return nil, nil, errors.New("kolom authorized_name wajib ada")
	}

	var rows []publisherRow
	var warnings []string
	for line := 2; ; line++ {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, nil, fmt.Errorf("read line %d: %w", line, err)
		}
		if isBlankRecord(record) {
			continue
		}

		row, rowWarnings, err := parsePublisherRow(line, record, index)
		warnings = append(warnings, rowWarnings...)
		if err != nil {
			return nil, nil, err
		}
		rows = append(rows, row)
	}
	return rows, warnings, nil
}

func headerIndex(header []string) map[string]int {
	index := make(map[string]int, len(header))
	for i, col := range header {
		key := normalizeHeader(col)
		if key != "" {
			index[key] = i
		}
	}
	return index
}

func normalizeHeader(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	value = strings.ReplaceAll(value, " ", "_")
	value = strings.ReplaceAll(value, "-", "_")
	return value
}

func parsePublisherRow(line int, record []string, index map[string]int) (publisherRow, []string, error) {
	get := func(key string) string {
		i, ok := index[key]
		if !ok || i >= len(record) {
			return ""
		}
		return strings.TrimSpace(record[i])
	}

	rawStatus := strings.ToLower(get("status"))
	rawConfidence := strings.ToLower(get("confidence_level"))
	rawPublisherCategory := strings.ToLower(get("publisher_category"))

	row := publisherRow{
		Line:               line,
		AuthorizedName:     cleanPublisherName(get("authorized_name")),
		AlternateNames:     get("alternate_names"),
		LegalName:          cleanPublisherName(get("legal_name")),
		BrandName:          cleanPublisherName(get("brand_name")),
		WebsiteURL:         get("website_url"),
		Email:              get("email"),
		Phone:              get("phone"),
		CountryID:          get("country_id"),
		CountryName:        get("country_name"),
		CityID:             get("city_id"),
		CityName:           get("city_name"),
		Address:            get("address"),
		HistoricalPeriod:   get("historical_period"),
		ImprintNames:       get("imprint_names"),
		PublisherCategory:  rawPublisherCategory,
		Status:             rawStatus,
		StatusProvided:     rawStatus != "",
		SourceURL:          get("source_url"),
		SourceNote:         get("source_note"),
		ConfidenceLevel:    rawConfidence,
		ConfidenceProvided: rawConfidence != "",
		Notes:              get("notes"),
	}

	if row.AuthorizedName == "" {
		return row, nil, fmt.Errorf("line %d: authorized_name wajib diisi", line)
	}
	if row.Status != "" && !validStatuses[row.Status] {
		return row, nil, fmt.Errorf("line %d: status tidak valid: %s", line, row.Status)
	}
	if row.ConfidenceLevel == "" {
		row.ConfidenceLevel = "medium"
	}
	if !validConfidenceLevels[row.ConfidenceLevel] {
		return row, nil, fmt.Errorf("line %d: confidence_level tidak valid: %s", line, row.ConfidenceLevel)
	}

	foundYear, err := parseOptionalInt(line, "birth_or_founding_year", get("birth_or_founding_year"))
	if err != nil {
		return row, nil, err
	}
	row.BirthOrFoundingYear = foundYear

	dissolutionYear, err := parseOptionalInt(line, "death_or_dissolution_year", get("death_or_dissolution_year"))
	if err != nil {
		return row, nil, err
	}
	row.DeathOrDissolutionYear = dissolutionYear

	verifiedAt, err := parseOptionalTime(line, "verified_at", get("verified_at"))
	if err != nil {
		return row, nil, err
	}
	row.VerifiedAt = verifiedAt
	if row.PublisherCategory != "" && !validPublisherCategories[row.PublisherCategory] {
		return row, nil, fmt.Errorf("line %d: publisher_category tidak valid: %s", line, row.PublisherCategory)
	}

	roles, roleWarnings, err := parseRoles(line, get("roles"))
	if err != nil {
		return row, nil, err
	}
	row.Roles = roles
	if row.PublisherCategory == "" {
		row.PublisherCategory = inferPublisherCategory(row)
	}
	if row.Status == "" || shouldNormalizeProvidedStatus(row) {
		row.Status = inferPublisherStatus(row)
	}
	return row, roleWarnings, nil
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

func parseOptionalInt(line int, field string, value string) (*int, error) {
	if value == "" {
		return nil, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return nil, fmt.Errorf("line %d: %s harus angka: %w", line, field, err)
	}
	return &parsed, nil
}

func parseOptionalTime(line int, field string, value string) (*time.Time, error) {
	if value == "" {
		return nil, nil
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02"} {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return &parsed, nil
		}
	}
	return nil, fmt.Errorf("line %d: %s harus format YYYY-MM-DD atau RFC3339", line, field)
}

func parseRoles(line int, value string) ([]string, []string, error) {
	if value == "" {
		return []string{"publisher"}, nil, nil
	}
	parts := strings.FieldsFunc(value, func(r rune) bool {
		return r == ',' || r == ';' || r == '|'
	})

	seen := map[string]bool{}
	var roles []string
	var warnings []string
	for _, part := range parts {
		role := strings.TrimSpace(strings.ToLower(part))
		role = strings.ReplaceAll(role, " ", "_")
		if role == "" {
			continue
		}
		if !validRoles[role] {
			return nil, nil, fmt.Errorf("line %d: role tidak valid: %s", line, role)
		}
		if seen[role] {
			warnings = append(warnings, fmt.Sprintf("line %d: role duplikat diabaikan: %s", line, role))
			continue
		}
		seen[role] = true
		roles = append(roles, role)
	}
	if len(roles) == 0 {
		return []string{"publisher"}, warnings, nil
	}
	return roles, warnings, nil
}

func inferPublisherCategory(row publisherRow) string {
	if hasRole(row.Roles, "printer") && !hasRole(row.Roles, "publisher") {
		return "printer"
	}
	haystack := publisherHaystack(row)
	if containsAny(haystack, "university press", "universitas", "university", "airlangga", "alma ata", "fhui", "fkip", "iaida", "unswagati") {
		return "university_press"
	}
	if strings.Contains(haystack, "academic publisher") || containsAny(haystack, "badan penerbit", "press") {
		return "academic_publisher"
	}
	if containsAny(haystack, "balai pustaka", "landsdrukkerij", "state publisher", "pemerintah") {
		return "government_publisher"
	}
	if containsAny(haystack, "kompas", "gramedia", "republika", "media group") {
		return "media_group_publisher"
	}
	if containsAny(haystack, "kanisius", "gunung mulia", "hidayah", "mizan", "ar-ruzz", "islam", "kristen", "pesantren") {
		return "religious_publisher"
	}
	if isHistoricalPublisher(row) || (row.BirthOrFoundingYear != nil && *row.BirthOrFoundingYear < 1950 && row.WebsiteURL == "") {
		return "historical_publisher"
	}
	return "trade_publisher"
}

func hasRole(roles []string, expected string) bool {
	for _, role := range roles {
		if role == expected {
			return true
		}
	}
	return false
}

func inferPublisherStatus(row publisherRow) string {
	if row.DeathOrDissolutionYear != nil || isClosedHistoricalPublisher(row.AuthorizedName) {
		return "closed"
	}
	if row.WebsiteURL != "" {
		return "active"
	}
	return "unknown"
}

func shouldNormalizeProvidedStatus(row publisherRow) bool {
	if row.Status != "active" {
		return false
	}
	return strings.Contains(strings.ToLower(row.SourceNote), "batch wikidata")
}

func publisherHaystack(row publisherRow) string {
	return strings.ToLower(strings.Join([]string{
		row.AuthorizedName,
		row.AlternateNames,
		row.LegalName,
		row.BrandName,
		row.HistoricalPeriod,
		row.Notes,
	}, " "))
}

func containsAny(value string, needles ...string) bool {
	for _, needle := range needles {
		if strings.Contains(value, needle) {
			return true
		}
	}
	return false
}

func isHistoricalPublisher(row publisherRow) bool {
	return isKnownHistoricalPublisher(row.AuthorizedName)
}

func isKnownHistoricalPublisher(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "a.c. nix & co",
		"albrecht & co",
		"e.j. brill",
		"g. kolff & co",
		"g.c.t. van dorp & co",
		"hoa siang in kiok",
		"j.b. wolters",
		"java-bode",
		"kho bie & co",
		"martinus nijhoff",
		"moestika",
		"noordhoff-kolff",
		"p. noordhoff",
		"poestaka rakjat",
		"pujangga baru",
		"tan khoen swie":
		return true
	default:
		return false
	}
}

func isClosedHistoricalPublisher(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "a.c. nix & co",
		"albrecht & co",
		"g. kolff & co",
		"g.c.t. van dorp & co",
		"hoa siang in kiok",
		"j.b. wolters",
		"java-bode",
		"kho bie & co",
		"landsdrukkerij",
		"moestika",
		"noordhoff-kolff",
		"p. noordhoff",
		"poestaka rakjat",
		"pujangga baru",
		"tan khoen swie":
		return true
	default:
		return false
	}
}

func importPublishers(ctx context.Context, pool *pgxpool.Pool, rows []publisherRow, warnings []string) (importStats, error) {
	stats := importStats{Rows: len(rows), Warnings: warnings}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return stats, fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	for _, row := range rows {
		countryID, countryWarnings, err := resolvePlaceID(ctx, tx, row.CountryID, row.CountryName)
		if err != nil {
			return stats, fmt.Errorf("line %d: negara: %w", row.Line, err)
		}
		stats.Warnings = append(stats.Warnings, prefixWarnings(row.Line, "country_name", countryWarnings)...)

		cityID, cityWarnings, err := resolvePlaceID(ctx, tx, row.CityID, row.CityName)
		if err != nil {
			return stats, fmt.Errorf("line %d: kota: %w", row.Line, err)
		}
		stats.Warnings = append(stats.Warnings, prefixWarnings(row.Line, "city_name", cityWarnings)...)

		agentID, inserted, err := upsertPublisher(ctx, tx, row, countryID, cityID)
		if err != nil {
			return stats, fmt.Errorf("line %d: upsert publisher: %w", row.Line, err)
		}
		if inserted {
			stats.Inserted++
		} else {
			stats.Updated++
		}

		roleCount, err := insertRoles(ctx, tx, agentID, row.Roles, row.SourceNote)
		if err != nil {
			return stats, fmt.Errorf("line %d: insert roles: %w", row.Line, err)
		}
		stats.Roles += roleCount
	}

	if err := tx.Commit(ctx); err != nil {
		return stats, fmt.Errorf("commit transaction: %w", err)
	}
	return stats, nil
}

func resolvePlaceID(ctx context.Context, tx pgx.Tx, explicitID string, name string) (*string, []string, error) {
	if explicitID != "" {
		return &explicitID, nil, nil
	}
	if name == "" {
		return nil, nil, nil
	}

	var id string
	err := tx.QueryRow(ctx, `
		SELECT id::text
		FROM places
		WHERE lower(preferred_name) = lower($1)
		ORDER BY place_type
		LIMIT 1
	`, name).Scan(&id)
	if err == nil {
		return &id, nil, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, []string{fmt.Sprintf("tempat belum ada di master places: %s", name)}, nil
	}
	return nil, nil, err
}

func prefixWarnings(line int, field string, warnings []string) []string {
	out := make([]string, 0, len(warnings))
	for _, warning := range warnings {
		out = append(out, fmt.Sprintf("line %d: %s: %s", line, field, warning))
	}
	return out
}

func upsertPublisher(ctx context.Context, tx pgx.Tx, row publisherRow, countryID *string, cityID *string) (string, bool, error) {
	foundYear := nullableInt(row.BirthOrFoundingYear)
	dissolutionYear := nullableInt(row.DeathOrDissolutionYear)
	countryIDValue := nullableString(countryID)
	cityIDValue := nullableString(cityID)
	verifiedAt := nullableTime(row.VerifiedAt)
	statusForUpdate := ""
	if row.StatusProvided {
		statusForUpdate = row.Status
	}
	confidenceForUpdate := ""
	if row.ConfidenceProvided {
		confidenceForUpdate = row.ConfidenceLevel
	}

	var existingID string
	err := tx.QueryRow(ctx, `
		WITH input AS (
			SELECT regexp_replace(
				regexp_replace(lower($1), '^(pt\.?|p\.?t\.?|cv\.?|n\.?v\.?|yayasan|penerbit)[[:space:]]+', ''),
				'[^a-z0-9]+',
				'',
				'g'
			) AS key
		)
		SELECT id::text
		FROM agents a, input
		WHERE a.agent_type = 'organization'
			AND (
				lower(a.authorized_name) = lower($1)
				OR regexp_replace(
					regexp_replace(lower(a.authorized_name), '^(pt\.?|p\.?t\.?|cv\.?|n\.?v\.?|yayasan|penerbit)[[:space:]]+', ''),
					'[^a-z0-9]+',
					'',
					'g'
				) = input.key
				OR EXISTS (
					SELECT 1
					FROM regexp_split_to_table(concat_ws(';', a.alternate_names, a.legal_name, a.brand_name), ';') AS alias_name
					WHERE regexp_replace(
						regexp_replace(lower(trim(alias_name)), '^(pt\.?|p\.?t\.?|cv\.?|n\.?v\.?|yayasan|penerbit)[[:space:]]+', ''),
						'[^a-z0-9]+',
						'',
						'g'
					) = input.key
				)
			)
		ORDER BY
			CASE WHEN lower(a.authorized_name) = lower($1) THEN 0 ELSE 1 END,
			a.created_at
		LIMIT 1
	`, row.AuthorizedName).Scan(&existingID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", false, err
	}

	if errors.Is(err, pgx.ErrNoRows) {
		var id string
		err := tx.QueryRow(ctx, `
			INSERT INTO agents (
				agent_type,
				authorized_name,
				alternate_names,
				legal_name,
				brand_name,
				birth_or_founding_year,
				death_or_dissolution_year,
				website_url,
				email,
				phone,
				country_id,
				city_id,
				address,
				historical_period,
				imprint_names,
				publisher_category,
				status,
				source_url,
				source_note,
				verified_at,
				confidence_level,
				notes
			)
			VALUES (
				'organization',
				$1,
				NULLIF($2, ''),
				NULLIF($3, ''),
				NULLIF($4, ''),
				$5,
				$6,
				NULLIF($7, ''),
				NULLIF($8, ''),
				NULLIF($9, ''),
				$10::uuid,
				$11::uuid,
				NULLIF($12, ''),
				NULLIF($13, ''),
				NULLIF($14, ''),
				NULLIF($15, ''),
				$16,
				NULLIF($17, ''),
				NULLIF($18, ''),
				$19,
				NULLIF($20, ''),
				NULLIF($21, '')
			)
			RETURNING id::text
		`,
			row.AuthorizedName,
			row.AlternateNames,
			row.LegalName,
			row.BrandName,
			foundYear,
			dissolutionYear,
			row.WebsiteURL,
			row.Email,
			row.Phone,
			countryIDValue,
			cityIDValue,
			row.Address,
			row.HistoricalPeriod,
			row.ImprintNames,
			row.PublisherCategory,
			row.Status,
			row.SourceURL,
			row.SourceNote,
			verifiedAt,
			row.ConfidenceLevel,
			row.Notes,
		).Scan(&id)
		return id, true, err
	}

	_, err = tx.Exec(ctx, `
		UPDATE agents
		SET
			alternate_names = COALESCE(NULLIF($2, ''), alternate_names),
			legal_name = COALESCE(NULLIF($3, ''), legal_name),
			brand_name = COALESCE(NULLIF($4, ''), brand_name),
			birth_or_founding_year = COALESCE($5, birth_or_founding_year),
			death_or_dissolution_year = COALESCE($6, death_or_dissolution_year),
			website_url = COALESCE(NULLIF($7, ''), website_url),
			email = COALESCE(NULLIF($8, ''), email),
			phone = COALESCE(NULLIF($9, ''), phone),
			country_id = COALESCE($10::uuid, country_id),
			city_id = COALESCE($11::uuid, city_id),
			address = COALESCE(NULLIF($12, ''), address),
			historical_period = COALESCE(NULLIF($13, ''), historical_period),
			imprint_names = COALESCE(NULLIF($14, ''), imprint_names),
			publisher_category = COALESCE(NULLIF($15, ''), publisher_category),
			status = COALESCE(NULLIF($16, ''), status),
			source_url = COALESCE(NULLIF($17, ''), source_url),
			source_note = COALESCE(NULLIF($18, ''), source_note),
			verified_at = COALESCE($19, verified_at),
			confidence_level = COALESCE(NULLIF($20, ''), confidence_level),
			notes = COALESCE(NULLIF($21, ''), notes)
		WHERE id = $1::uuid
	`,
		existingID,
		row.AlternateNames,
		row.LegalName,
		row.BrandName,
		foundYear,
		dissolutionYear,
		row.WebsiteURL,
		row.Email,
		row.Phone,
		countryIDValue,
		cityIDValue,
		row.Address,
		row.HistoricalPeriod,
		row.ImprintNames,
		row.PublisherCategory,
		statusForUpdate,
		row.SourceURL,
		row.SourceNote,
		verifiedAt,
		confidenceForUpdate,
		row.Notes,
	)
	return existingID, false, err
}

func nullableString(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableInt(value *int) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableTime(value *time.Time) any {
	if value == nil {
		return nil
	}
	return *value
}

func insertRoles(ctx context.Context, tx pgx.Tx, agentID string, roles []string, sourceNote string) (int, error) {
	count := 0
	for _, role := range roles {
		tag, err := tx.Exec(ctx, `
			INSERT INTO agent_roles (agent_id, role, source_note)
			VALUES ($1::uuid, $2, NULLIF($3, ''))
			ON CONFLICT (agent_id, role) DO UPDATE
			SET source_note = COALESCE(NULLIF(EXCLUDED.source_note, ''), agent_roles.source_note)
		`, agentID, role, sourceNote)
		if err != nil {
			return count, err
		}
		count += int(tag.RowsAffected())
	}
	return count, nil
}

func isBlankRecord(record []string) bool {
	for _, value := range record {
		if strings.TrimSpace(value) != "" {
			return false
		}
	}
	return true
}

func printStats(stats importStats) {
	fmt.Printf("Baris CSV: %d\n", stats.Rows)
	fmt.Printf("Penerbit baru: %d\n", stats.Inserted)
	fmt.Printf("Penerbit diperbarui: %d\n", stats.Updated)
	fmt.Printf("Role ditulis: %d\n", stats.Roles)
	if stats.Skipped > 0 {
		fmt.Printf("Baris dilewati: %d\n", stats.Skipped)
	}
	if len(stats.Warnings) > 0 {
		fmt.Println("Peringatan:")
		for _, warning := range stats.Warnings {
			fmt.Printf("- %s\n", warning)
		}
	}
}
