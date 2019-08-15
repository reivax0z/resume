default: generate
.PHONY: default

install:
	npm install
.PHONY: install

generate: clean
	mkdir input
	cp README.md ./input/index.md
	npm run generate
.PHONY: generate

clean:
	rm -fr input
	rm -fr output
.PHONY: clean
