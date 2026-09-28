package experience

import (
	"context"
	"errors"
	"testing"

	"portfolio/internal/validate"
)

type fakeStore struct{ saved Input }

func (f *fakeStore) List(context.Context) ([]Experience, error) { return nil, nil }
func (f *fakeStore) GetByID(context.Context, int64) (Experience, error) {
	return Experience{}, ErrNotFound
}
func (f *fakeStore) Delete(context.Context, int64) error { return nil }
func (f *fakeStore) Update(_ context.Context, _ int64, in Input) (Experience, error) {
	f.saved = in
	return Experience{}, nil
}
func (f *fakeStore) Create(_ context.Context, in Input) (Experience, error) {
	f.saved = in
	return Experience{}, nil
}

func ptr(s string) *string { return &s }

func TestDateRules(t *testing.T) {
	base := Input{Company: "Acme", Position: "Dev", StartDate: "2022-05-01"}

	tests := []struct {
		name      string
		mutate    func(*Input)
		wantField string // "" = valid
	}{
		{"finished job with end date", func(in *Input) { in.EndDate = ptr("2023-01-31") }, ""},
		{"same start and end day", func(in *Input) { in.EndDate = ptr("2022-05-01") }, ""},
		{"current job", func(in *Input) { in.IsCurrent = true }, ""},
		{"finished job without end date", func(in *Input) {}, "endDate"},
		{"blank end date counts as missing", func(in *Input) { in.EndDate = ptr("  ") }, "endDate"},
		{"end before start", func(in *Input) { in.EndDate = ptr("2021-12-31") }, "endDate"},
		{"impossible date", func(in *Input) { in.StartDate = "2022-02-30"; in.IsCurrent = true }, "startDate"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			in := base
			tt.mutate(&in)
			_, err := NewService(&fakeStore{}).Create(context.Background(), in)

			var verr *validate.Error
			if tt.wantField == "" {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				return
			}
			if !errors.As(err, &verr) || verr.Fields[tt.wantField] == "" {
				t.Errorf("err = %v, want error on %s", err, tt.wantField)
			}
		})
	}
}

func TestCurrentJobDropsEndDate(t *testing.T) {
	store := &fakeStore{}
	_, err := NewService(store).Create(context.Background(), Input{
		Company: "Acme", Position: "Dev", StartDate: "2022-05-01",
		EndDate: ptr("2024-01-01"), IsCurrent: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if store.saved.EndDate != nil {
		t.Errorf("EndDate = %v, want nil for a current job (DB constraint requires it)", *store.saved.EndDate)
	}
}
