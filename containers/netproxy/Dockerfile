FROM golang:latest AS builder

RUN go install github.com/magefile/mage@latest

WORKDIR /src
COPY containers/netproxy /src
RUN mage build

FROM icr/cribase

<<<<<<< HEAD
COPY --from=builder /src/bin/netproxy /netproxy
=======
COPY containers/netproxy/netproxy /netproxy
>>>>>>> fb220e0766f930f4bd6af2c5362fc60328612ecc
RUN install /netproxy /bin
