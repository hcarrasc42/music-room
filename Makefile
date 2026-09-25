.PHONY: install dev stop test seed load clean

install:
	cd backend && npm install
	cd mobile && npm install

dev:
	docker compose up -d
	cd backend && npm run start:dev &
	cd mobile && npx expo start

stop:
	docker compose down
	@pkill -f "nest start" 2>/dev/null || true
	@pkill -f "expo start" 2>/dev/null || true

test:
	cd backend && npm run test

seed:
	cd backend && npm run seed

load:
	k6 run docs/load/vote-scenario.js

clean:
	docker compose down -v
	rm -rf backend/node_modules mobile/node_modules
	rm -rf backend/dist
