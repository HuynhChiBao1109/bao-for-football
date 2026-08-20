pipeline {
    agent any

    stages {
        stage('Pull Source') {
            steps {
                dir('/home/b4f/fifam') {
                    sh '''
                        git checkout master
                        git pull origin master
                    '''
                }
            }
        }

        stage('Deploy') {
            steps {
                dir('/home/b4f/fifam/deployments/docker') {
                    sh '''
                        sh ../../scripts/start-docker.sh
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'DEPLOY SUCCESS'
        }

        failure {
            echo 'DEPLOY FAILED'
        }
    }
}
