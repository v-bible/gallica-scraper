<div align="center">

  <h1>gallica-scraper</h1>

  <p>
    Digital Gallica Library Scraper
  </p>

</div>

<br />

<!-- Table of Contents -->

# :notebook_with_decorative_cover: Table of Contents

- [About the Project](#star2-about-the-project)
  - [Environment Variables](#key-environment-variables)
- [Getting Started](#toolbox-getting-started)
  - [Prerequisites](#bangbang-prerequisites)
  - [Run Locally](#running-run-locally)
- [Usage](#eyes-usage)
- [Contributing](#wave-contributing)
  - [Code of Conduct](#scroll-code-of-conduct)
- [License](#warning-license)
- [Contact](#handshake-contact)

<!-- About the Project -->

## :star2: About the Project

<!-- Env Variables -->

### :key: Environment Variables

To run this project, you will need to add the following environment variables to
your `.env` file:

- **App configs:**
  - `LOG_LEVEL`: Log level.
  - `LOG_FILE_PATH`: (Optional) File path to save logs. Default to `scraper.log`.

E.g:

```
# .env
LOG_LEVEL=info
```

You can also check out the file `.env.example` to see all required environment
variables.

<!-- Getting Started -->

## :toolbox: Getting Started

<!-- Prerequisites -->

### :bangbang: Prerequisites

- This project uses [pnpm](https://pnpm.io/) as package manager:

  ```bash
  npm install --global pnpm
  ```

  <!-- Run Locally -->

### :running: Run Locally

Clone the project:

```bash
git clone https://github.com/v-bible/gallica-scraper.git
```

Go to the project directory:

```bash
cd gallica-scraper
```

Install dependencies:

```bash
pnpm install
```

Build the project:

```bash
pnpm build
```

<!-- Usage -->

## :eyes: Usage

```bash
USAGE
  gallica-scraper [--outDir value] [--toPdf] <args>...
  gallica-scraper --help
  gallica-scraper --version

Digital Gallica Library Scraper

FLAGS
     [--outDir]           Output directory. Default to "./output/<document-name>"
     [--toPdf/--noToPdf]  Convert downloaded images to a single PDF file
  -h  --help              Print help information and exit
  -v  --version           Print version information and exit

ARGUMENTS
  args...  List of document urls to scrape from Gallica (e.g., "https://gallica.bnf.fr/ark:/12148/bpt6k42278868", "https://gallica.bnf.fr/ark:/12148/bpt6k42472912")
```

**Example**:

```bash
pnpm build && ./dist/cli.js --outDir ./my-output --toPdf https://gallica.bnf.fr/ark:/12148/bpt6k42472912
```

<!-- Contributing -->

## :wave: Contributing

<a href="https://github.com/v-bible/gallica-scraper/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=v-bible/gallica-scraper" />
</a>

Contributions are always welcome!

Please read the [contribution guidelines](./CONTRIBUTING.md).

<!-- Code of Conduct -->

### :scroll: Code of Conduct

Please read the [Code of Conduct](./CODE_OF_CONDUCT.md).

<!-- License -->

## :warning: License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** License.

[![License: CC BY-NC-SA 4.0](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png)](https://creativecommons.org/licenses/by-nc-sa/4.0/).

See the **[LICENSE.md](./LICENSE.md)** file for full details.

<!-- Contact -->

## :handshake: Contact

Duong Vinh - [@duckymomo20012](https://twitter.com/duckymomo20012) -
tienvinh.duong4@gmail.com

Project Link:
[https://github.com/v-bible/gallica-scraper](https://github.com/v-bible/gallica-scraper).
