export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        service: "Trinity PC Bridge V2",
        status: "serving",
        cloud: true
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
};
