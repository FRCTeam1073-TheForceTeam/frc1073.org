.PHONY: run
run:
	@echo "Starting Jekyll server with live reload..."
	BUNDLE_PATH=vendor/bundle bundle exec jekyll serve --livereload --open-url &
	@echo "Server started in background. Visit http://localhost:4000"

.PHONY: stop
stop:
	@echo "Stopping Jekyll server..."
	pkill -f "jekyll serve"

.PHONY: clean
clean:
	BUNDLE_PATH=vendor/bundle bundle exec jekyll clean

.PHONY: install
install:
	bundle config set path 'vendor/bundle'
	bundle install
	npm install
	pre-commit install

.PHONY: test
test:
	npm test

.PHONY: verify
verify:
	@node scripts/check-links.js
