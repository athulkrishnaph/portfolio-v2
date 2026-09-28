package chat

import (
	"sync"
	"time"
)

// dailyQuota caps the number of questions for all visitors together per UTC
// day, so the site stays inside the Gemini free tier instead of failing with
// quota errors. It is in memory: a restart resets it, which is acceptable
// for a single-server portfolio.
type dailyQuota struct {
	mu    sync.Mutex
	limit int // 0 = unlimited
	day   string
	used  int
	now   func() time.Time
}

func newDailyQuota(limit int) *dailyQuota {
	return &dailyQuota{limit: limit, now: time.Now}
}

// take uses one question from today's quota; false if none are left.
func (q *dailyQuota) take() bool {
	if q.limit <= 0 {
		return true
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	today := q.now().UTC().Format("2006-01-02")
	if today != q.day {
		q.day, q.used = today, 0
	}
	if q.used >= q.limit {
		return false
	}
	q.used++
	return true
}
