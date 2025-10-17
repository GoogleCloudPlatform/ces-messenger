### How to compile the custom templates

You will need to use the handlebars precomiler installed on your computer. See
the [instructions here](https://handlebarsjs.com/guide/installation/precompilation.html#getting-started).

One you have it, simply run this command from the root of the repository.

```bash
handlebars doc/examples/resources/ -e hbs -f doc/examples/resources/custom_templates.js 
```

