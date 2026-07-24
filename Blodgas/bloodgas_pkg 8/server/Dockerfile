FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY ocr-server-local.js logger.js ./

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "ocr-server-local.js"]
