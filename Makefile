.PHONY: tutorial
tutorial:
	rm -rf ./irmin-tutorial
	mkdir -p tutorial
	git clone https://github.com/zshipko/irmin-tutorial.git || (git pull -C irmin-tutorial origin master)
	cd irmin-tutorial && $(MAKE) generate
	mv irmin-tutorial/out/* ./tutorial
