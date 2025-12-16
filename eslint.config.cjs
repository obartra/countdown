const { FlatCompat } = require("@eslint/eslintrc");
const js = require("@eslint/js");
const reactHooks = require("eslint-plugin-react-hooks");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const patchReactHooksPlugin = (plugin) => {
  if (!plugin || plugin.__patchedForESLint9) {
    return plugin;
  }

  const patchedRules = Object.fromEntries(
    Object.entries(plugin.rules ?? {}).map(([name, rule]) => {
      if (!rule || typeof rule.create !== "function") {
        return [name, rule];
      }

      const originalCreate = rule.create;

      return [
        name,
        {
          ...rule,
          create(context) {
            let currentNode = null;
            const compatContext =
              context.getScope && context.getSourceCode
                ? context
                : Object.create(context, {
                    getSourceCode: { value: () => context.sourceCode },
                    getScope: {
                      value: () => {
                        const sourceCode = context.sourceCode;

                        if (typeof sourceCode?.getScope === "function") {
                          return sourceCode.getScope(
                            currentNode ?? sourceCode.ast,
                          );
                        }

                        return undefined;
                      },
                    },
                  });

            const listeners = originalCreate(compatContext);

            if (!listeners || typeof listeners !== "object") {
              return listeners;
            }

            const wrapHandler = (handler) => {
              if (typeof handler !== "function") {
                return handler;
              }

              return function (node, ...args) {
                if (node) {
                  currentNode = node;
                }
                return handler.call(this, node, ...args);
              };
            };

            return Object.fromEntries(
              Object.entries(listeners).map(([selector, handler]) => {
                if (typeof handler === "function") {
                  return [selector, wrapHandler(handler)];
                }

                if (handler && typeof handler === "object") {
                  return [
                    selector,
                    Object.fromEntries(
                      Object.entries(handler).map(([key, fn]) => [
                        key,
                        wrapHandler(fn),
                      ]),
                    ),
                  ];
                }

                return [selector, handler];
              }),
            );
          },
        },
      ];
    }),
  );

  const patchedPlugin = { ...plugin, rules: patchedRules };
  Object.defineProperty(patchedPlugin, "__patchedForESLint9", {
    value: true,
    writable: false,
  });
  return patchedPlugin;
};

const patchedReactHooks = patchReactHooksPlugin(reactHooks);

const baseConfigs = compat.config({
  env: {
    browser: true,
    es2023: true,
    node: true,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react", "react-hooks", "@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    "react-hooks/exhaustive-deps": "off",
    "react/react-in-jsx-scope": "off",
  },
  overrides: [
    {
      files: ["cypress/**/*.cy.{js,jsx,ts,tsx}"],
      env: { mocha: true, browser: true },
      globals: {
        cy: "readonly",
        Cypress: "readonly",
        expect: "readonly",
      },
    },
  ],
});

const configs = baseConfigs.map((config) => {
  const reactHooksPlugin = config.plugins?.["react-hooks"];

  if (!reactHooksPlugin) {
    return config;
  }

  return {
    ...config,
    plugins: {
      ...config.plugins,
      "react-hooks": patchedReactHooks,
    },
  };
});

module.exports = [
  {
    ignores: ["docs/**", "node_modules/**", "public/**", "dist/**"],
  },
  ...configs,
];
