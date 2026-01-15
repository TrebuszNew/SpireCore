![Logo](./imgs/Logo.png)
#
SpireCore is a component of [SpireStudio](https://github.com/TrebuszNew/SpireStudio) responsible for processing and converting logic written in XML into the Rust programming language. It operates as a transpiler that sequentially analyzes the XML structure, interprets block definitions, and executes the instructions assigned to them to generate the resulting source code.
> [!CAUTION]
> SpireCore is under active development.\
> APIs, XML structure, and module interfaces may change.\
> Not recommended for production use yet.


## Usage
SpireCore can be used anywhere behavior and logic are described in a declarative manner and appropriate modules are available. Example use cases include:
- Games and interactive experiences
- Desktop applications
- Servers and backends
- CLI tools
- Graphics and multimedia
- Data analysis
- Automation and scripting
- Simulations
- And much more...

## Example
Example logic written in XML:
```xml
<on_start>
    <log>
        <value>"Hello world!"</value>
    </log>
</on_start>
```
After being processed by SpireCore and running the generated code, the following will be printed to the terminal:
```
Hello world!
```
## Roadmap
- [ ]  Better error messages
- [ ]  Python support
- [ ]  Asynchronous code
- [ ]  Cross-compilation
- [ ]  Fix module conflicts
- [ ]  Module config categories support
- [ ]  Add `style` section
- [ ]  Add `whenRequire` section

## FAQ

**Q: Can I use SpireCore as a standalone CLI tool?**\
A: While possible, SpireCore is primarily designed as the backend for **[SpireStudio](https://github.com/TrebuszNew/SpireStudio)**. For the best experience, we recommend using the Studio.

**Q: Why Rust?**\
A: We chose Rust for its performance and memory safety, ensuring that logic is as fast and reliable as possible. Additionally we also plan to implement Python support to enable the rapid startup times essential for a smooth development workflow.

**Q: I have a question not listed here!**\
A: I'm open to feedback and questions. Feel free to open a Discussion or reach out to me directly – I’ll be happy to help!