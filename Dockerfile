FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:16.18

ENV NODE_ENV production
#ARG SSH_PRIVATE_KEY
EXPOSE 8080

WORKDIR /app

## load SSH key
## 1. install dependencies
#RUN apt-get update
#RUN apt-get install -y git openssh-client
#
## 2. import key
#RUN mkdir -p -m 0700 /root/.ssh/
#RUN echo "${SSH_PRIVATE_KEY}" | base64 -d > /root/.ssh/id_ed25519
#RUN chmod 600 ~/.ssh/id_ed25519
#
## 3. make sure domain is accepted and using SSH in Node
#RUN touch /root/.ssh/known_hosts
#RUN ssh-keygen -F github.com || ssh-keyscan github.com >> /root/.ssh/known_hosts
#RUN git config --global url."git@github.com:".insteadOf "https://github.com/"

# only copying package.json files to take advantage of cached Docker layers
COPY ["package.json", "package-lock.json*", "./"]

RUN npm run install:deploy

COPY . .

RUN npm run build

CMD ["npm", "run", "start"]
