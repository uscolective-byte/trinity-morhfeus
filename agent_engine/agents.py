from functools import cached_property
from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.genai import Client
from google.adk.tools import agent_tool
from google.adk.tools.google_search_tool import GoogleSearchTool
from google.adk.tools import url_context

class GlobalGemini(Gemini):
    @cached_property
    def api_client(self) -> Client:
        return Client(vertexai=True, location="global")

app_builder_agent = LlmAgent(
    name='app_builder_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Generates complete multi-file project structures and application code.',
    instruction='You are the Application Builder sub-agent for TRINITY. Generate complete, production-ready codebases.',
)

devops_deploy_agent = LlmAgent(
    name='devops_deploy_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Specializes in Git workflows, CI/CD, and cloud deployments.',
    instruction='You are the DevOps & Cloud Specialist sub-agent for TRINITY.',
)

research_specialist_google_search_agent = LlmAgent(
    name='Research_Specialist_google_search_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Agent specialized in Google searches.',
    instruction='Use the GoogleSearchTool to find information.',
    tools=[GoogleSearchTool()],
)

research_specialist_url_context_agent = LlmAgent(
    name='Research_Specialist_url_context_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Agent specialized in fetching URL content.',
    instruction='Use the UrlContextTool to retrieve content.',
    tools=[url_context],
)

research_agent = LlmAgent(
    name='research_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Performs web research and documentation lookups.',
    instruction='You are the Research Specialist sub-agent for TRINITY.',
    tools=[
        agent_tool.AgentTool(agent=research_specialist_google_search_agent),
        agent_tool.AgentTool(agent=research_specialist_url_context_agent)
    ],
)

security_audit_agent = LlmAgent(
    name='security_audit_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Audits codebases for security vulnerabilities.',
    instruction='You are the Security & Code Auditor sub-agent for TRINITY.',
)

qa_test_agent = LlmAgent(
    name='qa_test_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Creates comprehensive test suites.',
    instruction='You are the QA & Test Engineer sub-agent for TRINITY.',
)

database_architect = LlmAgent(
    name='database_architect',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Designs database schemas and migrations.',
    instruction='You are the Database Architect sub-agent for TRINITY.',
)

root_agent = LlmAgent(
    name='TRINITY_Core',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Central orchestration hub and lead AI systems architect.',
    sub_agents=[
        app_builder_agent,
        devops_deploy_agent,
        research_agent,
        security_audit_agent,
        qa_test_agent,
        database_architect
    ],
    instruction='You are TRINITY Core, an advanced autonomous AI systems architect and central operational hub.',
)
