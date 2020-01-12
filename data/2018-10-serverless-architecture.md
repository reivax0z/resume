# Serverless micro-services architecture - Lessons learnt & recommendations

> Tags: #microservice #serverless #architecture #lambda #aws #asynchronous #decoupled #scalability #failover

___

## Content
- [Architecture](#Architecture)
	- [SQS](#SQS)
	- [DynamoDB + Stream](#DynamoDB-+-Stream)
- [Pros vs Cons](#Pros-vs-Cons)
- [Lessons Learnt](#Lessons-Learnt)
	- [Poison Messages](#Poison-Messages)
	- [Stateless Implementation](#Stateless-Implementation)
	- [Private VPC](#Private-VPC)
- [Decision](#Decision)
	- [Serverless](#Serverless)
	- [EC2](#EC2)
- [Conclusion](#Conclusion)

___

## Architecture
For one of our main clients, we wanted to get an architecture that catered for `asynchronous` and `decoupled` business logic as well as easy `scalability` and `fail-over recovery`.

Based on those requirements, we have decided to go with the following architecture for our micro-services:
- API Gateway
- Lambda (synchronous)
	- Gets triggered by API Gateway
	- Validates payload & auth token
	- Fetches data from internal system
	- Encrypts data
	- Pushes data to queueing system
	- Returns success message to calling system
- Queueing System
	- Stores the information with a given TTL
	- Allows for failure recovery (replay message)
- Lambda (asynchronous)
	- Gets triggered by queueing system 
	- Decrypts data
	- Handles the Business logic (data transformation, calls other systems...)

Note that on top of this, our app secret management is done using CredStash. CredStash is a service that allows you to store / retrieve secrets and handles their versioning. Under the hood, the secrets are encoded using KMS and the storage is done via DynamoDB.

With this design in mind, 2 main implementations arise for the queueing system: SQS vs DynamoDB.

### SQS
At the time of the design choice, SQS was not supported as a Lambda event source, which meant the following implication:
- SQS does not provide a direct integration with Lambda.
- You need an EC2 instance and a long-lived service (ie: express server app).
- Your service needs to poll SQS regularly to fetch new messages.

However, since the 28/06/18, Lambda now supports SQS as an event source. 
See announcement: [here](https://aws.amazon.com/blogs/aws/aws-lambda-adds-amazon-simple-queue-service-to-supported-event-sources/)

With SQS, you also need to care for the following rules:
- The messages stay available in the queue until marked as processed or TTL expires (configurable from 1min to 14 days).
- You need to remove the message from the queue manually once successfully processed.
- Order might not be preserved.

### DynamoDB + Stream
The DynamoDB is used to store data temporarily (which can be used for logging / audit) and allows to trigger a Stream on each data change.

With DynamoDB Stream, you get the following:
- Stream offers a direct integration with Lambda.
- No need to poll / delete messages manually.
- Easy scale up / down (out-of-the-box offer by AWS).
- Auto recovery in case of errors (the stream does not move forward until the current batch of messages succeeds).
- 24h data retention (non configurable).
- Order is preserved.

## Pros vs Cons
**Pros:**
- Asynchronous & decoupled business logic
- Scalability
- Metrics + Logging
- Alarms based on log filters + Metrics
- Fail-over recovery
- ”Cheaper” than EC2

**Cons:**
- Poison messages mgmt.
- Stateless implementation
- Lambda in private VPC
- Artefact size limit (50MB)
- Lambda cold starts

## Lessons Learnt
From our own hands-on experience, trying to deliver value quickly to the client, here are some of the main hurdles we faced and how manage / approach them.  

### Poison Messages
When a message part of a batch fails, the entire batch fails. This means that the batch will be retried (your system needs to allow the same message to be processed multiple times). 

This design is great for recovery purposes: If a downstream system is down, the stream will retry the failing batch until it succeeds (the downstream system gets back up) and the message processing will move forward. This is also great if the order of the messages is important for your design (as the stream will enforce the order).

But, in case of an actual poison message, the stream will be blocked until the TTL expires. The data retention being 24h, your system might be stuck for up to 1 day because of an invalid message in your stream. When this happens, there is no recovery possible (deleting your record in DynamoDB still won't remove it from the existing stream) except: waiting for the TTL to expire, or deleting your resource and restarting fresh.

If you are worried about this situation, then this design might not be the best available to your needs. Or you need to be able (by code) to detect a poison message and reject it: either up in the processing (before saving it into DynamoDB in the first place) or down in the processing line (more risky and costly). For the later, you will need to be able to retry (by code) the failing message, and if it fails again, decide it might be a poison one, then mark it as properly processed so the lambda can mark the batch as successful and allows the process to continue.

Note that this behaviour should mainly appear during testing phase, when a contract is not respected between your internal components. You have to make your stakeholder understand the risks and what they want to do in case of failure.

### Stateless Implementation
One of the main issues found when using this architecture is that the Lambdas are by definition Stateless. 

In the current solution, the secrets configuration of the micro-service is hosted in CredStash (certificates, encryption, passwords,...) and loaded on each call to Lambda. This starts to be a bottleneck as the configuration grows bigger and it adds an extra overhead internet call each time the service is trying to process a message. In this case, it could make sense to live in a Stateful environment.

If you end up having an important overhead caused by the statelessness of the design, it might indicate that you need some kind of long-lived solution to handle the implementation of your micro-services (therefore moving away from a Stateless architecture).

### Private VPC
One of the requirements of our project was to have the system living in a private VPC.

Unfortunately, Lambdas have not been designed to perform well in such an environment, and we have witnessed issues when deleting a deployed Lambda: the deletion takes up to 1h, getting stuck on the Network Interface removal.

When this happens, the following message is being displayed in the AWS console:
> CloudFormation is waiting for NetworkInterfaces associated with the Lambda Function to be cleaned up.

Also note that using a private VPC with Lambda adds a huge overhead on your cold start, as stated here: 
> Stay as far away from VPCs as you possibly can! VPC access requires Lambda to create ENIs (elastic network interface) to the target VPC and that easily adds 10s (yeah, you’re reading it right) to your cold start.
(See this article for more details about Lambda cold starts: [here](https://hackernoon.com/im-afraid-you-re-thinking-about-aws-lambda-cold-starts-all-wrong-7d907f278a4f))

## Decision
You now have to decide to go Serverless (using Lambda) or using a more classic and Stateful environment (using EC2).

### Serverless
As depicted in this discussion, the Serverless architecture approach allows to leverage some out-of-the-box AWS goodness:
- Scalability
- Logging capability
- Metrics
- Alarms (based on logs + metrics)
- Quite cheap to run (depends on memory used and response time)

All of this is given and allows to focus on the core business logic rather than spending time on the infrastructure itself.

However, nothing is perfect and we have already depicted some of the main drawbacks of this design, meaning you will need proper thinking before choosing to go Serverless.

### EC2
On the other hand, with EC2, you are the one managing the infrastructure. This means that to achieve the above outcome, the following will need to happen:
- Provide your own scalability capability
- Configure an Elastic Load Balancer
- Configure an Auto-scaling group
- Create your own Logging system
- Create your own Metrics system
- Manage your own Alarms system
- Create your own AMI
- Can be expensive to run (depends on the number of instances and their size)

On the plus side, EC2 is perfect for Stateful applications. For instance, this enables your configuration or secrets to be loaded only once (at start time) rather than on each call (for the Stateless solution).

## Conclusion
Based on the above analysis, a way to decide which solution to go for will depend on:
- Your `budget`
- Your `deadline` (EC2 solution usually takes longer to implement than going Serverless, mainly because of the infrastructure setup cost)
- Your `application load & complexity`:
	- how many requests per day?
	- what is the average response time?
	- how big is the needed computing power?
- Your `stack` (e.g. node.js is a lot more lightweight than Java)
- Your `DevOps capability` (EC2 needs a lot of infrastructure work to be put into in order to be a viable production-ready solution)

A decent article comparing both architectures can be found [here](https://medium.freecodecamp.org/node-js-apis-on-aws-the-pros-and-cons-of-express-versus-serverless-a370ab7eadd7) (mainly for a node.js implementation)

Regarding cost, here are some websites that can be used to derive estimates:
- [https://dashbird.io](https://dashbird.io/lambda-cost-calculator/)
- [https://servers.lol](https://servers.lol/)
- [https://calculator.s3.amazonaws.com](https://calculator.s3.amazonaws.com/index.html)

In order to compare what is comparable, we try to stick with:
> Serverless = 3 * m3.large EC2 instances 

And we apply the following formula:
> Serverless Cost < EC2 Cost + 40%

If this formula is respected, then going Serverless (Lambda) should be a viable solution for your project.
