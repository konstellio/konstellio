FROM travisci/ci-garnet:packer-1490989530
COPY . /home/travis/project
COPY .travis.build.sh /home/travis/build.sh
CMD [ "/home/travis/build.sh" ]