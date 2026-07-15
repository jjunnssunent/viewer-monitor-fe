"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Home;
const image_1 = require("next/image");
const page_module_css_1 = require("./page.module.css");
function Home() {
    return (<div className={page_module_css_1.default.page}>
      <main className={page_module_css_1.default.main}>
        <image_1.default className={page_module_css_1.default.logo} src="/next.svg" alt="Next.js logo" width={100} height={20} priority/>
        <div className={page_module_css_1.default.intro}>
          <h1>To get started, edit the page.tsx file.</h1>
          <p>
            Looking for a starting point or more instructions? Head over to{" "}
            <a href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app" target="_blank" rel="noopener noreferrer">
              Templates
            </a>{" "}
            or the{" "}
            <a href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app" target="_blank" rel="noopener noreferrer">
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className={page_module_css_1.default.ctas}>
          <a className={page_module_css_1.default.primary} href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app" target="_blank" rel="noopener noreferrer">
            <image_1.default className={page_module_css_1.default.logo} src="/vercel.svg" alt="Vercel logomark" width={16} height={16}/>
            Deploy Now
          </a>
          <a className={page_module_css_1.default.secondary} href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app" target="_blank" rel="noopener noreferrer">
            Documentation
          </a>
        </div>
      </main>
    </div>);
}
//# sourceMappingURL=page.js.map