default: generate
.PHONY: default

generate: clean
	mkdir input
	cp README.md ./input/index.md
	npx generate-md  --layout github --input ./input --output ./output
.PHONY: generate

clean:
	rm -fr input
	rm -fr output
.PHONY: clean
