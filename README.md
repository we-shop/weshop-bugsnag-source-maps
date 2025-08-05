# @weshop/bugsnag-source-maps

**WeShop's private fork of @bugsnag/source-maps**

This is a private fork of the original Bugsnag source maps CLI and library, customized for WeShop's needs.

## Installation

Install from WeShop's private registry:

```sh
npm install --save-dev @weshop/bugsnag-source-maps --registry <your-private-registry>
```

You can then run the CLI using:

```sh
npx bugsnag-source-maps [...args]
```

## System requirements

`@bugsnag/source-maps` requires Node.js v10+

## Usage

See the [Bugsnag docs website](https://docs.bugsnag.com/build-integrations/js/#uploading-source-maps) for full usage documentation.

```
bugsnag-source-maps --help

  bugsnag-source-maps <command>

Available commands

  upload-browser
  upload-node
  upload-react-native

Options

  -h, --help    show this message
  --version     output the version of the CLI module
```

## Bugsnag On-Premise

If you are using Bugsnag On-premise, you should use the endpoint option to set the url of your [upload server](https://docs.bugsnag.com/on-premise/single-machine/service-ports/#bugsnag-upload-server), for example:

```sh
bugsnag-source-maps upload-browser \
  --endpoint https://bugsnag.my-company.com/
  # ... other options
```

## Support

* Check out the [documentation](https://docs.bugsnag.com/build-integrations/js/#uploading-source-maps)
* [Search open and closed issues](https://github.com/bugsnag/bugsnag-source-maps/issues?q=+) for similar problems
* [Report a bug or request a feature](https://github.com/bugsnag/bugsnag-source-maps/issues/new)

## Contributing

Most updates to this repo will be made by Bugsnag employees. We are unable to accommodate significant external PRs such as features additions or any large refactoring, however minor fixes are welcome. See [contributing](CONTRIBUTING.md) for more information.

## Fork Maintenance

### Merging Upstream Changes

To merge changes from the original Bugsnag repository:

1. **Add upstream remote** (if not already added):
   ```sh
   git remote add upstream https://github.com/bugsnag/bugsnag-source-maps.git
   ```

2. **Fetch upstream changes**:
   ```sh
   git fetch upstream
   ```

3. **Merge upstream changes**:
   ```sh
   git checkout next  # or your main branch
   git merge upstream/next
   ```

4. **Resolve any conflicts** and test thoroughly

5. **Update version** following the WeShop versioning pattern:
   ```sh
   # If upstream released 2.4.0, update to:
   npm version 2.4.0-weshop.1
   ```

### WeShop-Specific Versioning

This fork uses semver pre-release identifiers to maintain compatibility with upstream:

- **Base version format**: `X.Y.Z-weshop.N`
- **Example progression**: `2.3.2-weshop.1` → `2.3.2-weshop.2` → `2.3.3-weshop.1`

#### Version Bump Commands

```sh
# WeShop-specific patch (bug fixes, small changes)
npm version prerelease --preid=weshop

# After merging upstream patch release (e.g., 2.3.3)
npm version 2.3.3-weshop.1

# After merging upstream minor release (e.g., 2.4.0)
npm version 2.4.0-weshop.1

# After merging upstream major release (e.g., 3.0.0)
npm version 3.0.0-weshop.1
```

#### Publishing

```sh
# Build and publish to private registry
npm run publish:private <your-registry-url>
```

### Upstream Tracking

- **Original repository**: https://github.com/bugsnag/bugsnag-source-maps
- **Current upstream base**: v2.3.2
- **WeShop modifications**: Private package configuration, custom publishing setup

## License

This package is free software released under the MIT License. See [LICENSE.txt](./LICENSE.txt) for details.
