.PHONY: install dev stop test seed load clean

install:
	npm run setup

dev:
	npm run dev

stop:
	npm run stop

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
