# floci-sample

flociについて学習するためのサンプル

## flociの立ち上げ方

```bash
docker run --rm -p 4566:4566 \
  floci/floci:latest
```

以下で起動を確認できます。

```bash
docker ps
```

```bash
CONTAINER ID   IMAGE                COMMAND                  CREATED          STATUS                    PORTS                                         NAMES
891ca2d2e988   floci/floci:latest   "/usr/local/bin/dock…"   27 seconds ago   Up 20 seconds (healthy)   0.0.0.0:4566->4566/tcp, [::]:4566->4566/tcp   exciting_ride
```

## AWS 設定

```bash
aws configure
```

## AWS CLIによるリソースの確認

```bash
aws --endpoint-url http://localhost:4566 \
  s3 mb s3://my-bucket

aws --endpoint-url http://localhost:4566 \
  sqs create-queue --queue-name my-queue
```

## 参考文献
- [GitHub floci](https://github.com/floci-io/floci)
- [floci 公式ドキュメント](https://floci.io/)