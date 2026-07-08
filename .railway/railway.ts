import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const web = service("web", {
    source: github("ralborta/cleexs"),
    build: "npm run build",
  });

  return project("Cleexs", {
    resources: [web],
  });
});
