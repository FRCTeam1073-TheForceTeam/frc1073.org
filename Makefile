.PHONY: run stop clean install

run:
	@echo "Starting Jekyll server with live reload..."
	bundle exec jekyll serve --livereload --open-url &
	@echo "Server started in background. Visit http://localhost:4000"

stop:
	@echo "Stopping Jekyll server..."
	pkill -f "jekyll serve"

clean:
	bundle exec jekyll clean

install:
	bundle install

.DEFAULT_GOAL := run
