# ilib-yaml

Library to turn yaml files into Resources and vice-versa.

# Usage

This library exports a class YamlFile which reads or writes
yaml files. You can then add instances of Resource or get
an array of Resource instances.

[API documentation](./docs/ilib-yaml.md)

To read a yaml file and convert it to Resources where the strings
appear as source strings:

```javascript
import YamlFile from 'ilib-yaml';

const yf1 = new YamlFile({
    pathName: "./my/en-US.yaml"
});
// or
const yf2 = new YamlFile();
yf2.read("./my/file.yaml");

const resources1 = yf1.getResources();
const resources2 = yf2.getResources();
```

To read a yaml file and convert it to Resources where the
strings appear as target strings:

```javascript
import YamlFile from 'ilib-yaml';

// the source strings
const src = new YamlFile({
    pathName: "./my/en-US.yaml"
});

// read this as target strings, and get the source
// strings from the YamlFile we pass in
const tgt = new YamlFile({
    pathName: "./my/de-DE.yaml",
    sourceYaml: src,
    locale: "de-DE"
});

const resources = tgt.getResources();
```

To convert an array of Resources into a yaml file:

```javascript
import YamlFile from 'ilib-yaml';

const yf = new YamlFile(); // no argument means new, empty instance

yf.addResource(resource);
// or
yf.addResources(resourceArray);

yf.write("./my/output.yaml");
```

Notes:

- yaml files are always read and written in UTF-8
- all entries in a yaml file are converted into Resource instances. In
  many cases, this is possibly not what you want. It is up to the caller
  to filter the Resource array afterwards to discard any entries that
  you do not want.

# License

Copyright 2024 JEDLSoft

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

# Release Notes

## 1.0.0

- extracted code from the loctool plugin ilib-loctool-yaml and made a separate
  library out of it so that it can be shared