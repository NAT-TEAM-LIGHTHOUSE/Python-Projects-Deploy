redis-cli -h 192.168.100.232 -p 6379 MONITOR

redis-cli -h 192.168.100.232 -p 6379 KEYS "checkpoint_latest:*"
redis-cli -h 192.168.100.232 -p 6379 KEYS "checkpoint:`<your-thread-id>`:*"
redis-cli -h 192.168.100.232 -p 6379 JSON.GET "`<checkpoint-key>`"

redis-cli -h 192.168.100.232 -p 6379 KEYS "checkpoint:12345556:*"

redis-cli -h 192.168.100.232 -p 6379 SCAN 0 MATCH "checkpoint:*" COUNT 100

redis-cli -h 192.168.100.232 -p 6379 JSON.GET "`<key>`"

#### Check Data using this cmd

**redis-cli -h 192.168.100.232 -p 6379 KEYS "checkpoint:12345556:*"**

**redis-cli -h 192.168.100.232 -p 6379 JSON.GET "checkpoint:12345556:empty:1f12803e-d118-6093-8008-9d1af4523527"**
