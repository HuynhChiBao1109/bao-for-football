package domain

import "context"

type Repository interface {
	GetByID(ctx context.Context, id int64) (*Club, error)
}
