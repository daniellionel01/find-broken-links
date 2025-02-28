const response = await fetch(
  "https://twitter.com/jarredsumner/status/1511707890708586496",
  {
    method: "GET",
    redirect: "follow",
  },
);
console.log(response);
