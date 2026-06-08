FROM python:3.12-slim

ENV TZ=Asia/Kolkata

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    build-essential \
    libaio-dev \
    gcc \
    make \
    iputils-ping \
    telnet \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

COPY instantclient-basic-linux.x64-12.2.0.1.0.zip /app/instantclient_basic.zip
COPY instantclient-sqlplus-linux.x64-12.2.0.1.0.zip /app/instantclient_sqlplus.zip

RUN unzip /app/instantclient_basic.zip -d /opt/oracle && \
    unzip /app/instantclient_sqlplus.zip -d /opt/oracle && \
    rm /app/instantclient_basic.zip /app/instantclient_sqlplus.zip && \
    ln -s /usr/lib/x86_64-linux-gnu/libaio.so /usr/lib/x86_64-linux-gnu/libaio.so.1

ENV PATH="/opt/oracle/instantclient_12_2:$PATH"
ENV LD_LIBRARY_PATH="/opt/oracle/instantclient_12_2"

RUN pip install --no-cache-dir \
    pip==25.0.1 \
    setuptools==70.0.0 \
    wheel

RUN pip install --no-build-isolation cx_Oracle==8.3.0

COPY . /app/

RUN pip install --no-cache-dir -r backend/requirements.txt

# Fix APScheduler for Python 3.12
RUN pip install --no-cache-dir --upgrade APScheduler==3.10.4

# CSV storage directory
RUN mkdir -p /app/backend/TableGpt_Plus

# Supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8060
EXPOSE 8080

CMD ["/usr/bin/supervisord","-c","/etc/supervisor/conf.d/supervisord.conf"]
