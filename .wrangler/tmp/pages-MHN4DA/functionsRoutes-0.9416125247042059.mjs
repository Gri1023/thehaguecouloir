import { onRequest as __api_site_content_js_onRequest } from "C:\\Users\\hryho\\Desktop\\The Hague Couloir website\\functions\\api\\site-content.js"

export const routes = [
    {
      routePath: "/api/site-content",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_site_content_js_onRequest],
    },
  ]