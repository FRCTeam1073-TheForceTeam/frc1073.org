.PHONY: run
run:
	@echo "Starting Jekyll server with live reload..."
	bundle exec jekyll serve --livereload --open-url &
	@echo "Server started in background. Visit http://localhost:4000"

.PHONY: stop
stop:
	@echo "Stopping Jekyll server..."
	pkill -f "jekyll serve"

.PHONY: clean
clean:
	bundle exec jekyll clean

.PHONY: install
install:
	bundle install
	npm install

.PHONY: verify
verify:
	node scripts/check-links.js
