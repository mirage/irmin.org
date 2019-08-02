.PHONY: check clean

MDX=ocaml-mdx

check:
	$(MDX) pp data/tutorial/introduction.md > data/book.ml
	$(MDX) pp data/tutorial/contents.md  >> data/book.ml
	$(MDX) pp data/tutorial/command-line.md >> data/book.ml
	$(MDX) pp data/tutorial/getting-started.md >> data/book.ml
	$(MDX) pp data/tutorial/backend.md  >> data/book.ml
	$(MDX) pp data/tutorial/graphql.md >> data/book.ml
	ocamlbuild -pkgs checkseum.c,digestif.c,irmin-unix -pkg hiredis data/book.native

clean:
	rm -f book.native data/book.ml
