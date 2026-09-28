.PHONY: run stop clean install verify

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

verify:
	@echo "Building site (with GitHub Pages config) and checking internal links..."
	bundle exec jekyll build --config _config.yml,_config.github-pages.yml --destination _site-verify
	bundle exec htmlproofer ./_site-verify --disable-external --swap-urls "/frc1073.org:/"
	@echo "Cleaning up verification build..."
	rm -rf _site-verify

.DEFAULT_GOAL := run
