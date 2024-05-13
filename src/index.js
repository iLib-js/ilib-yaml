/*
 * index.js - implement the YamlFile class
 *
 * Copyright © 2024 JEDLSoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as yamllib from 'yaml';
import { ResourceString, TranslationSet } from 'ilib-tools-common';

/**
 * @class Represents a yaml source file.
 *
 */
class Yaml {
    /**
     * Constructor a new Yaml instance.
     *
     * If the instance is constructed with a sourceYaml parameter, then the resources
     * for this intance will be considered to be translated strings. Every string read
     * from the current yaml file will be looked up in the sourceYaml instance by id
     * for the corresponding source string and strings in this instance will be the
     * translated string. If no sourceYaml parameter is provided, then this instance
     * will be considered as a source yaml, and all strings read will appear as the
     * source of the Resource instances.<p>
     *
     * If the yaml contains comments, these will appear as comments on the Resource
     * instances as well.
     *
     * @constructor
     * @param {Object} props properties that control the construction of this file.
     * @param {YamlFile} props.sourceYaml If the current file contains translations,
     * the corresponding source string can be found in this yaml instance
     * @param {string} props.pathName The path to the file
     * @param {string} props.project The name of the project to apply to all Resource instances
     * @param {string} props.locale for source-only yaml files, this is the source locale.
     * For source and target yaml files, this is the target locale to apply
     * to all Resource instances
     * @param {string} props.context The context to apply to every Resource instance
     * @param {string} props.state The state to apply to every Resource instance
     * @param {string} props.datatype The datatype to apply to every Resource instance
     * @param {string} props.flavor The flavor to apply to every Resource instance
     * @param {Function(string, string)} props.filter Provide a filter that tells whether
     * or not the current key/value pair should be included as a Resource. This filter
     * is called on each yaml entry before the Resource is created. If the filter returns
     * false, the entry is skipped and no Resource is created. If it returns true, or if
     * there was no filter specified, then the Resource is created normally.
     */
    constructor(props) {
        if (props) {
            this.sourceYaml = props.sourceYaml;
            this.pathName = props.pathName;
            this.project = props.project;
            this.locale = props.locale;
            this.context = props.context;
            this.state = props.state;
            this.datatype = props.datatype;
            this.flavor = props.flavor;
            this.filter = typeof(props.filter) === "function" ? props.filter : undefined;
        }

        this.commentsMap = new Map();
        this.set = new TranslationSet();
    }

    /**
     * Constructs full element key by escaping the dots.
     *
     * @param {string} prefix the prefix of this key
     * @param {string} key the key to normalize
     * @returns {string} the normalized key
     *
     * @private
     */
    normalizeKey(prefix, key) {
        return (prefix ? prefix + "." : "") + key.toString().replace(/\./g, '\\.');
    }

    /**
     * Extract comments from Node and store it in a map.
     * element_id => extracted_comment
     *
     * @param {String} key id of the node
     * @param {Object} node node to parse and extract comment from
     * @param {String} firstComment comment from the level above,
     * due to the fact that by default first comment in a YAMLMap is assigned
     * to the YAMLMap's value itself, but not the first element in the map
     *
     * @private
     */
    parseNodeComment(key, node, firstComment) {
        if (yamllib.isPair(node)) {
            if (firstComment || node.key.commentBefore) {
                this.commentsMap.set(this.normalizeKey(key, node.key.value), firstComment || node.key.commentBefore);
            }
            this.parseNodeComment(this.normalizeKey(key, node.key.value), node.value, node.value.commentBefore);
        } else if (yamllib.isSeq(node)) {
            node.items.forEach((mapNode, i) => {
                this.parseNodeComment(this.normalizeKey(key, i), mapNode, i === 0 ? firstComment : undefined);
            });
        } else if (yamllib.isMap(node)) {
            node.items.forEach((mapNode, i) => {
                this.parseNodeComment(key, mapNode, i === 0 ? firstComment : undefined);
            });
        } else if (yamllib.isScalar(node)) {
            if (firstComment || node.commentBefore) {
                this.commentsMap.set(key, firstComment || node.commentBefore);
            }
        }
    }

    /**
     * Parse a yml file as Document and traverse nodes tree
     * and extract comments.
     *
     * @private
     */
    parseComments = function() {
        if (!this.json) return; // can't parse undefined!
debugger;
        this.document.contents.items.forEach(node => {
            this.parseNodeComment(node);
        });
    }

    /**
     * @private
     */
    parseResources(prefix, obj, set, localize) {
        const locale = this.locale;
        for (var key in obj) {
            if (typeof(obj[key]) === "object") {
                this.parseResources(this.normalizeKey(prefix, key), obj[key], set, localize);
            } else if (localize) {
                const resource = obj[key];
                const reskey = this.normalizeKey(prefix, key);

                // we check if filter is a function in the constructor
                if (this.filter && !this.filter(reskey, resource)) {
                    // skip this entry, as the caller has filtered it out
                    continue;
                }

                // this.logger.trace("Adding string resource " + JSON.stringify(resource) + " locale " + this.getLocale());
                var params = {
                    resType: "string",
                    project: this.project,
                    key: reskey,
                    autoKey: true,
                    pathName: this.pathName,
                    datatype: this.datatype,
                    localize: localize,
                    index: this.resourceIndex++
                };
                if (locale === this.sourceLocale || this.flavor) {
                    params.sourceLocale = locale;
                    params.source = resource;
                    params.flavor = this.flavor;
                } else {
                    params.sourceLocale = this.project.sourceLocale;
                    params.target = resource;
                    params.targetLocale = locale;
                }

                if (this.commentsMap.has(reskey)) {
                    const comment = this.commentsMap.get(reskey).trim();
                    if (this.getCommentPrefix()) {
                        if (comment.startsWith(this.getCommentPrefix())) {
                            params.comment = comment.slice(this.getCommentPrefix().length).trim();
                        }
                    } else {
                        params.comment = comment;
                    }
                }

                const res = new ResourceString(params);

                set.add(res);
            }
        }
    }

    /**
     * Return the path name that is used to construct all Resource instances.
     * @returns {string} the path used to construct all Resource instances
     */
    getPath() {
        return this.pathName;
    }

    /**
     * Deserialize a string containing the contents of a yaml file into an array
     * of Resource instances.
     *
     * @param {string} content The contents of the file to parse
     */
    deserialize(content) {
        this.resourceIndex = 0;
        this.document = yamllib.parseDocument(content);
        this.json = yamllib.parse(content);
        this.parseComments();
        this.parseResources(undefined, this.json, this.set, true);
    }

    serialize() {}

    getResource(id) {}

    /**
     * Return the set of resources in this yaml file.
     *
     * @returns
     */
    getResources() {
        return this.set.getResources();
    }

    /**
     * Return a translation set with all the resources from the current file in it.
     *
     * @returns {TranslationSet} the set with all the resources in it
     */
    getTranslationSet() {
        return this.set;
    }

    addResource(resource) {}

    addResources(resourceArray) {}
}

export default Yaml;


/**
 * @private
 *
YamlFile.prototype._mergeOutput = function(prefix, obj, set) {
    for (var key in obj) {
        if (typeof(obj[key]) === "object") {
            this._mergeOutput(this._normalizeKey(prefix, key), obj[key], set);
        } else {
            var resource = obj[key];
            if (this._isTranslatable(resource)) {
                this.logger.trace("Found string resource " + JSON.stringify(resource) + " with key " + key + " locale " + this.getLocale());
                var resources = (this.getLocale() === this.project.sourceLocale) ?
                    set.getBy({reskey: key, pathName: this.pathName, sourceLocale: this.getLocale(), project: this.project.getProjectId()}) :
                    set.getBy({reskey: key, pathName: this.pathName, targetLocale: this.getLocale(), project: this.project.getProjectId()});

                var existing = resources && resources[0];
                if (existing && !existing.getLocalize()) {
                    // modify in place
                    if (this.getLocale() === this.project.sourceLocale) {
                        existing.setSource(resource);
                    } else {
                        existing.setTarget(resource);
                    }
                    set.dirty = true;
                } else if (existing) {
                    this.logger.debug("Overwriting value for string resource " + JSON.stringify(existing));
                }
            }
        }
    }
}

/**
 * Parse a yml file and store the resources found in it into the
 * file's translation set.
 *
 * @param {String} str the string to parse
 *
YamlFile.prototype.parse = function(str) {
    this.resourceIndex = 0;
    this.json = yaml.parse(str);
    var prefix = this.pathName ? this.API.utils.hashKey(path.normalize(this.pathName)) : undefined;
    this._parseComments(prefix, str);
    this._parseResources(prefix, this.json, this.set, true);
};


/**
 * Extract comments from Node and store it in a map.
 * element_id => extracted_comment
 *
 * @param {String} key id of the node
 * @param {Object} node node to parse and extract comment from
 * @param {String} firstComment comment from the level above,
 * due to the fact that by default first comment in a YAMLMap is assigned
 * to the YAMLMap's value itself, but not the first element in the map
 *
 * @private
 *
YamlFile.prototype._parseNodeComment = function(key, node, firstComment) {
    if (yaml.isPair(node)) {
        if (firstComment || node.key.commentBefore) {
            this.commentsMap.set(this._normalizeKey(key, node.key.value), firstComment || node.key.commentBefore);
        }
        this._parseNodeComment(this._normalizeKey(key, node.key.value), node.value, node.value.commentBefore);

    } else if (yaml.isSeq(node)) {
        node.items.forEach((mapNode, i) => {
            this._parseNodeComment(this._normalizeKey(key, i), mapNode, i === 0 ? firstComment : undefined);
        });
    } else if (yaml.isMap(node)) {
        node.items.forEach((mapNode, i) => {
            this._parseNodeComment(key, mapNode, i === 0 ? firstComment : undefined);
        });
    } else if (yaml.isScalar(node)) {
        if (firstComment || node.commentBefore) {
            this.commentsMap.set(key, firstComment || node.commentBefore);
        }
    }
}


/**
 * Parse a target yml file, compare to source's entries
 * Where a non-localizable resource from the target matches
 * one from the source, keep the value from the target file
 *
 * @param {String} str the string to parse
 *
YamlFile.prototype.parseOutputFile = function(str) {
    var json = yaml.parse(str);
    this._mergeOutput(undefined, json, this.set, true);
};

/**
 * Extract all of the resources from this file and keep them in
 * memory.
 *
YamlFile.prototype.extract = function() {
    this.logger.debug("Extracting strings from " + this.pathName);
    if (this.pathName) {
        var p = path.join(this.project.root, this.pathName);
        try {
            var data = fs.readFileSync(p, "utf8");
            if (data) {
                this.parse(data);
            }
        } catch (e) {
            this.logger.warn("Could not read file: " + p);
            this.logger.warn(e);
        }
    }

    // mark this set as not dirty after we read it from disk
    // so we can tell when other code has added resources to it
    this.set.setClean();
};

YamlFile.prototype._loadSchema = function () {
    if (!this.type.isLegacyMode()) {
        this.schema = this.mapping;
        return;
    }

    // Legacy schema handling.
    if (this.getSchemaPath()) {
        var p = path.join(this.project.root, this.getSchemaPath());
        try {
            var data = fs.readFileSync(p, "utf8");
            if (data) {
                this.schema = JSON.parse(data);
            }
        } catch (e) {
            this.logger.warn("No schema file found at " + p);
        }
    }
}

/**
 * Get the path name of this resource file.
 *
 * @returns {String} the path name to this file
 *
YamlFile.prototype.getPath = function() {
    return this.pathName;
};

/**
 * Get the path name of schema file for the given resource file.
 *
 * @returns {String} the path name to this file
 *
YamlFile.prototype.getSchemaPath = function() {
    if (this.pathName) {
        return this.pathName.replace(".yml", "-schema.json");
    }
};

/**
 * Get the schema object
 *
 * @returns {Object} the options loaded from the schema file
 *
YamlFile.prototype.getSchema = function() {
    return this.schema;
};

/**
 * Get the locale of this resource file.
 *
 * @returns {String} the locale spec of this file
 *
YamlFile.prototype.getLocale = function() {
    return this.locale;
};

/**
 * Get the locale of this resource file.
 *
 * @returns {String} the locale spec of this file
 *
YamlFile.prototype.getContext = function() {
    return "";
};

/**
 * Get the flavor of this resource file. The flavor determines
 * the customization of the strings, which allows for different English
 * source strings for the same resource key based on the flavor. For
 * example, if your app has the string "Log-in" when there is no flavor,
 * it might have the strings "Enter your partner ID:" for one partner,
 * and "Enter your member number:" for a different partner. Each of the
 * strings with a different flavor is a source string that needs to be
 * translated separately, even though they have the same key.
 *
 * @returns {String|undefined} the flavor of this file, or undefined
 * for no flavor
 *
YamlFile.prototype.getFlavor = function() {
    return this.flavor;
};


/**
 * Get all resources from this file. This will return all resources
 * of mixed types (strings, arrays, or plurals).
 *
 * @returns {Resource} all of the resources available in this resource file.
 *
YamlFile.prototype.getAll = function() {
    return this.set.getAll();
};

/**
 * Add a resource to this file. The locale of the resource
 * should correspond to the locale of the file, and the
 * context of the resource should match the context of
 * the file.
 *
 * @param {Resource} res a resource to add to this file
 *
YamlFile.prototype.addResource = function(res) {
    this.logger.trace("YamlFile.addResource: " + JSON.stringify(res) + " to " + this.project.getProjectId() + ", " + this.locale + ", " + JSON.stringify(this.context));
    if (res && res.getProject() === this.project.getProjectId()) {
        this.logger.trace("correct project. Adding.");
        this.set.add(res);
    } else {
        if (res) {
            this.logger.warn("Attempt to add a resource to a resource file with the incorrect project.");
        } else {
            this.logger.warn("Attempt to add an undefined resource to a resource file.");
        }
    }
};


/**
 * Add every resource in the given array to this file.
 * @param {Array.<Resource>} resources an array of resources to add
 * to this file
 *
YamlFile.prototype.addAll = function(resources) {
    if (resources && resources.length) {
        resources.forEach(function(resource) {
            this.addResource(resource);
        }.bind(this));
    }
};

/**
 * Return true if this resource file has been modified
 * since it was loaded from disk.
 *
 * @returns {boolean} true if this resource file has been
 * modified since it was loaded
 *
YamlFile.prototype.isDirty = function() {
    return this.set.isDirty();
};

/**
 * Generate the content of the resource file.
 *
 * @private
 * @returns {String} the content of the resource file
 *
YamlFile.prototype.getContent = function() {
    var json = {};

    if (this.set.isDirty()) {
        var resources = this.set.getAll();

        for (var j = 0; j < resources.length; j++) {
            var target, resource = resources[j];
            if (resource.resType === "plural" || resource.getTarget() || resource.getSource()) {
                var key = resource.getKey();
                var lastKey = key;
                var parent = json;
                if (key && key.length) {
                    var parts = key.split(/(?<!\\)\./g);
                    if (parts.length > 1 && parts[0] == this.API.utils.hashKey(path.normalize(this.pathName))) {
                        parts = parts.slice(1);
                    }
                    if (parts.length > 1) {
                        for (var i = 0; i < parts.length-1; i++) {
                            if (!parent[parts[i]]) {
                                parent[parts[i]] = {};
                            }
                            parent = parent[parts[i]];
                        }
                    }
                    lastKey = parts[parts.length-1];
                }
                lastKey = lastKey.replace(/\\./g, '.');
                if (resource.resType === "plural") {
                    this.logger.trace("writing plural translation for " + resource.getKey() + " as " + JSON.stringify(resource.getTargetPlurals() || resource.getSourcePlurals()));
                    parent[lastKey] = resource.getTargetPlurals() || resource.getSourcePlurals();
                } else {
                    this.logger.trace("writing translation for " + resource.getKey() + " as " + (resource.getTarget() || resource.getSource()));
                    parent[lastKey] = resource.getTarget() || resource.getSource();
                }
            } else {
                this.logger.warn("String resource " + resource.getKey() + " has no source text. Skipping...");
            }
        }
    }

    this.logger.trace("json is " + JSON.stringify(json));

    // now convert the json back to yaml
    return yaml.stringify(json, {
        schema: 'failsafe',
        sortMapEntries: true,
        lineWidth: 0,
        doubleQuotedAsJSON: true
    });
};

//we don't write to yaml source files
YamlFile.prototype.write = function() {};

/**
 * Return the set of resources found in the current Android
 * resource file.
 *
 * @returns {TranslationSet} The set of resources found in the
 * current Java file.
 *
YamlFile.prototype.getTranslationSet = function() {
    return this.set;
}

/**
 * Return the location on disk where the version of this file localized
 * for the given locale should be written. This should be relative to
 * the root of the project.
 *
 * @param {String} locale the locale spec for the target locale
 * @returns {String} the localized path name
 *
YamlFile.prototype.getLocalizedPath = function(locale) {
    if (this.type.isLegacyMode()) {
        return this._getLocalizedPathLegacy(locale);
    }

    var mapping = this.mapping || this.type.getMapping(this.pathName) || this.type.getDefaultMapping();

    return path.normalize(this.API.utils.formatPath(mapping.template, {
        sourcepath: this.pathName,
        locale: locale
    }));
};

/**
 * Legacy version of getLocalizedPath().
 *
 * @private
 *
 * @param {String} locale the locale spec for the target locale
 * @returns {String} the localized path name
 *
YamlFile.prototype._getLocalizedPathLegacy = function(locale) {
    var fullPath = this.getOutputFilenameForLocale(locale);
    var dirName = path.dirname(fullPath);
    var fileName = path.basename(fullPath);
    if (this.getUseLocalizedDirectoriesFromSchema()) {
        var fullDir = path.join(dirName, locale);
        return path.join(fullDir, fileName);
    }
    return fullPath;
};

/**
 * @private
 *
YamlFile.prototype._localizeContent = function(prefix, obj, translations, locale, localize) {
    var ret = {};
    this.resourceIndex = 0;

    for (var key in obj) {
        if (typeof(obj[key]) === "object") {
            if (obj[key]) {
                var localizeChildren = localize && (this.getExcludedKeysFromSchema().indexOf(key) === -1);
                ret[key] = this._localizeContent(this._normalizeKey(prefix, key), obj[key], translations, locale, localizeChildren);
            } else {
                ret[key] = "";
            }
        } else if (localize && this.getExcludedKeysFromSchema().indexOf(key) === -1) {
            var resource = obj[key];
            if (this._isTranslatable(resource)) {
                var tester = this.API.newResource({
                    resType: "string",
                    project: this.project.getProjectId(),
                    sourceLocale: this.project.getSourceLocale(),
                    reskey: this._normalizeKey(prefix, key),
                    pathName: this.pathName,
                    datatype: this.type.datatype
                });
                var hashkey = tester.hashKeyForTranslation(locale);

                this.logger.trace("Localizing string resource " + JSON.stringify(resource) + " locale " + locale);
                var res = translations.get(hashkey);
                if (locale === this.project.pseudoLocale && this.project.settings.nopseudo) {
                    ret[key] = obj[key].toString();
                } else if (!res && this.type && this.type.pseudos[locale]) {
                    var source, sourceLocale = this.type.pseudos[locale].getPseudoSourceLocale();
                    if (sourceLocale !== this.project.sourceLocale) {
                        // translation is derived from a different locale's translation instead of from the source string
                        var sourceRes = translations.get(tester.hashKeyForTranslation(sourceLocale));
                        source = sourceRes ? sourceRes.getTarget() : obj[key].toString();
                        ret[key] = this.type.pseudos[locale].getString(source);
                        this.dirty |= (sourceRes && ret[key] !== source);
                    } else {
                        source = obj[key].toString();
                        ret[key] = this.type.pseudos[locale].getString(source);
                        this.dirty |= (ret[key] !== source);
                    }
                } else {
                    if (res && this.API.utils.cleanString(res.getSource()) === this.API.utils.cleanString(obj[key].toString())) {
                        this.logger.trace("Translation: " + res.getTarget());
                        ret[key] = res.getTarget();
                        this.dirty |= (ret[key] !== res.getSource());
                    } else {
                        var note = res ? 'The source string has changed. Please update the translation to match if necessary. Previous source: "' + res.getSource() + '"' : undefined;
                        if (this.type) {
                            this.type.newres.add(this.API.newResource({
                                resType: "string",
                                project: this.project.getProjectId(),
                                key: this._normalizeKey(prefix, key),
                                source: obj[key],
                                sourceLocale: this.project.sourceLocale,
                                target: (res && res.getTarget()) || obj[key],
                                targetLocale: locale,
                                pathName: this.pathName,
                                datatype: this.type.datatype,
                                state: "new",
                                flavor: this.flavor,
                                comment: note,
                                index: this.resourceIndex++
                            }));
                        }
                        this.logger.trace("Missing translation");
                        ret[key] = this.type && this.type.missingPseudo && !this.project.settings.nopseudo ?
                            this.type.missingPseudo.getString(resource) : resource;
                        this.dirty |= (ret[key] !== resource);
                    }
                }
            } else {
                ret[key] = obj[key].toString();
            }
        } else {
            ret[key] = obj[key].toString();
        }
    }

    return ret;
}

/**
 * Localize the text of the current file to the given locale and return
 * the results.
 *
 * @param {TranslationSet} translations the current set of translations
 * @param {String} locale the locale to translate to
 * @returns {String} the localized text of this file
 *
YamlFile.prototype.localizeText = function(translations, locale) {
    var output = "";
    if (this.json) {
        this.dirty = false;
        var prefix = this.pathName ? this.API.utils.hashKey(path.normalize(this.pathName)) : undefined;
        var localizedJson = this._localizeContent(prefix, this.json, translations, locale, true);
        if (localizedJson) {
            this.logger.trace("Localized json is: " + JSON.stringify(localizedJson, undefined, 4));

            try {
                output = yaml.stringify(localizedJson, {
                    schema: 'failsafe',
                    sortMapEntries: true,
                    lineWidth: 0,
                    doubleQuotedAsJSON: true
                });
            } catch (e) {
                console.log("Error while localizing file " + this.pathName + " for locale " + this.locale);
                console.log(JSON.stringify(localizedJson, undefined, 4));
                throw e;
            }
        }
    }
    return output;
};

/**
 * Localize the contents of this template file and write out the
 * localized template file to a different file path.
 *
 * @param {TranslationSet} translations the current set of
 * translations
 * @param {Array.<String>} locales array of locales to translate to
 *
YamlFile.prototype.localize = function(translations, locales) {
    // don't localize if there is no text
    if (this.json) {
        for (var i = 0; i < locales.length; i++) {
            var p, pathName = this.getLocalizedPath(locales[i]);
            this.logger.debug("Checking for existing output file " + pathName);

            try {
                p = path.join(this.project.root, pathName);
                if (fs.existsSync(p)) {
                    var data = fs.readFileSync(p, "utf8");
                    if (data) {
                        this.parseOutputFile(data);
                    }
                }
            } catch (e) {
                this.logger.warn("Could not read file: " + p);
                this.logger.warn(e);
            }

            this.logger.debug("Writing file " + pathName);
            p = path.join(this.project.target, pathName);
            var dir = path.dirname(p);
            this.API.utils.makeDirs(dir);
            fs.writeFileSync(p, this.localizeText(translations, locales[i]), "utf-8");
        }
    } else {
        this.logger.debug(this.pathName + ": No json, no localize");
    }
};

/**
 * Extract values of key 'excludedKeys' or 'excluded_keys' from the loaded schema.
 * 'excluded_keys' are used for backward compatibility reason.
 *
 * @return {Array.<String>} keys that should not be localized at output time
 *
YamlFile.prototype.getExcludedKeysFromSchema = function() {
    if (this.schema) {
        if (Array.isArray(this.schema['excludedKeys'])) {
            return this.schema['excludedKeys']
        } else if (Array.isArray(this.schema['excluded_keys'])) {
            return this.schema['excluded_keys'];
        }
    }

    return [];
}

/**
 * Extract values of key 'useLocalizedDirectories' from the loaded schema
 * Defaults to TRUE
 *
 * @return {Boolean} whether output should be written to directory for locale,
 * or kept in same directory as source.
 *
YamlFile.prototype.getUseLocalizedDirectoriesFromSchema = function() {
    if (this.schema && typeof(this.schema['useLocalizedDirectories']) === "boolean") {
        return this.schema['useLocalizedDirectories'];
    }
    return true;
}

/**
 * Extract matching value for string locale from object 'outputFilenameMapping' in the loaded schema
 *
 * @param {String} locale locale for which to look for a custom filename
 * @return {String} string filename specified for the given locale in the schema object
 *  defaults to file's own pathname
 *
YamlFile.prototype.getOutputFilenameForLocale = function(locale) {
    if (
        this.schema && this.schema['outputFilenameMapping']
        && typeof(locale) === "string" && this.schema['outputFilenameMapping'][locale]
    ) {
        return this.schema['outputFilenameMapping'][locale];
    }
    return path.normalize(this.pathName);
}

/**
 * Extract values of key 'commentPrefix' from the loaded schema
 *
 * @returns {String|undefined}
 *
YamlFile.prototype.getCommentPrefix = function() {
    if (this.schema && typeof(this.schema['commentPrefix']) === 'string') {
        return this.schema['commentPrefix'];
    }

    return undefined;
}

module.exports = YamlFile;
*/
